#include "clipboard_image.h"

#include <windows.h>
#include <wincodec.h>
#include <wrl/client.h>

#include <cstring>

namespace aqutter_shell {

namespace {

using Microsoft::WRL::ComPtr;

// 開啟剪貼簿，離開作用域時關閉。其他程式剛好占用時重試幾次。
class ClipboardLock {
 public:
  ClipboardLock() {
    for (int attempt = 0; attempt < 10; ++attempt) {
      if (::OpenClipboard(nullptr)) {
        open_ = true;
        return;
      }
      ::Sleep(20);
    }
  }
  ~ClipboardLock() {
    if (open_) ::CloseClipboard();
  }
  bool ok() const { return open_; }

 private:
  bool open_ = false;
};

// 確保這個執行緒有 COM；Flutter 的 runner 通常已經初始化過，模式不同時沿用現況即可。
void EnsureCom() {
  const HRESULT result = ::CoInitializeEx(nullptr, COINIT_APARTMENTTHREADED);
  (void)result;  // S_OK、S_FALSE、RPC_E_CHANGED_MODE 都可以繼續
}

ComPtr<IWICImagingFactory> CreateFactory() {
  EnsureCom();
  ComPtr<IWICImagingFactory> factory;
  ::CoCreateInstance(CLSID_WICImagingFactory, nullptr, CLSCTX_INPROC_SERVER,
                     IID_PPV_ARGS(&factory));
  return factory;
}

UINT PaletteBytes(const BITMAPINFOHEADER& header) {
  if (header.biBitCount > 8) {
    // 有色彩遮罩的格式（BITMAPINFOHEADER 之後緊接三個遮罩）
    return header.biCompression == BI_BITFIELDS && header.biSize == sizeof(BITMAPINFOHEADER)
               ? 12
               : 0;
  }
  const UINT colors = header.biClrUsed != 0 ? header.biClrUsed : (1u << header.biBitCount);
  return colors * 4;
}

// 把剪貼簿的 DIB（BITMAPINFO 加像素）補上檔案標頭，變成一份完整的 BMP 位元組。
std::vector<uint8_t> DibToBmp(const uint8_t* dib, size_t size) {
  BITMAPINFOHEADER header;
  std::memcpy(&header, dib, sizeof(header));
  BITMAPFILEHEADER file = {};
  file.bfType = 0x4D42;  // "BM"
  file.bfSize = static_cast<DWORD>(sizeof(file) + size);
  file.bfOffBits = static_cast<DWORD>(sizeof(file) + header.biSize + PaletteBytes(header));
  std::vector<uint8_t> bmp(sizeof(file) + size);
  std::memcpy(bmp.data(), &file, sizeof(file));
  std::memcpy(bmp.data() + sizeof(file), dib, size);
  return bmp;
}

// 把任何 WIC 能解碼的圖片位元組（BMP、PNG、JPEG）重新編碼成 PNG。
bool EncodePng(IWICImagingFactory* factory, const uint8_t* data, size_t size,
               std::vector<uint8_t>* png) {
  ComPtr<IWICStream> input;
  if (FAILED(factory->CreateStream(&input)) ||
      FAILED(input->InitializeFromMemory(const_cast<uint8_t*>(data), static_cast<DWORD>(size)))) {
    return false;
  }
  ComPtr<IWICBitmapDecoder> decoder;
  if (FAILED(factory->CreateDecoderFromStream(input.Get(), nullptr, WICDecodeMetadataCacheOnDemand,
                                              &decoder))) {
    return false;
  }
  ComPtr<IWICBitmapFrameDecode> frame;
  if (FAILED(decoder->GetFrame(0, &frame))) return false;

  ComPtr<IStream> output;
  if (FAILED(::CreateStreamOnHGlobal(nullptr, TRUE, &output))) return false;
  ComPtr<IWICBitmapEncoder> encoder;
  if (FAILED(factory->CreateEncoder(GUID_ContainerFormatPng, nullptr, &encoder)) ||
      FAILED(encoder->Initialize(output.Get(), WICBitmapEncoderNoCache))) {
    return false;
  }
  ComPtr<IWICBitmapFrameEncode> target;
  if (FAILED(encoder->CreateNewFrame(&target, nullptr)) || FAILED(target->Initialize(nullptr))) {
    return false;
  }
  if (FAILED(target->WriteSource(frame.Get(), nullptr)) || FAILED(target->Commit()) ||
      FAILED(encoder->Commit())) {
    return false;
  }
  HGLOBAL memory = nullptr;
  if (FAILED(::GetHGlobalFromStream(output.Get(), &memory))) return false;
  const SIZE_T length = ::GlobalSize(memory);
  const void* source = ::GlobalLock(memory);
  if (source == nullptr) return false;
  png->assign(static_cast<const uint8_t*>(source), static_cast<const uint8_t*>(source) + length);
  ::GlobalUnlock(memory);
  return true;
}

// 解碼圖片位元組成 32 位元 BGRA 像素，並組成 CF_DIB 要的 BITMAPINFOHEADER 加像素。
bool DecodeToDib(IWICImagingFactory* factory, const std::vector<uint8_t>& bytes,
                 std::vector<uint8_t>* dib) {
  ComPtr<IWICStream> input;
  if (FAILED(factory->CreateStream(&input)) ||
      FAILED(input->InitializeFromMemory(const_cast<uint8_t*>(bytes.data()),
                                         static_cast<DWORD>(bytes.size())))) {
    return false;
  }
  ComPtr<IWICBitmapDecoder> decoder;
  if (FAILED(factory->CreateDecoderFromStream(input.Get(), nullptr, WICDecodeMetadataCacheOnDemand,
                                              &decoder))) {
    return false;
  }
  ComPtr<IWICBitmapFrameDecode> frame;
  if (FAILED(decoder->GetFrame(0, &frame))) return false;
  ComPtr<IWICFormatConverter> converter;
  if (FAILED(factory->CreateFormatConverter(&converter)) ||
      FAILED(converter->Initialize(frame.Get(), GUID_WICPixelFormat32bppBGRA,
                                   WICBitmapDitherTypeNone, nullptr, 0.0,
                                   WICBitmapPaletteTypeCustom))) {
    return false;
  }
  UINT width = 0;
  UINT height = 0;
  if (FAILED(converter->GetSize(&width, &height)) || width == 0 || height == 0) return false;

  const UINT stride = width * 4;
  BITMAPINFOHEADER header = {};
  header.biSize = sizeof(header);
  header.biWidth = static_cast<LONG>(width);
  header.biHeight = static_cast<LONG>(height);  // 正值：傳統的由下往上，所有程式都看得懂
  header.biPlanes = 1;
  header.biBitCount = 32;
  header.biCompression = BI_RGB;
  header.biSizeImage = stride * height;

  // WIC 給的是由上往下的像素列，DIB 要由下往上：整列反轉
  std::vector<uint8_t> top_down(header.biSizeImage);
  if (FAILED(converter->CopyPixels(nullptr, stride, header.biSizeImage, top_down.data()))) {
    return false;
  }
  dib->assign(sizeof(header) + header.biSizeImage, 0);
  std::memcpy(dib->data(), &header, sizeof(header));
  for (UINT row = 0; row < height; ++row) {
    std::memcpy(dib->data() + sizeof(header) + static_cast<size_t>(row) * stride,
                top_down.data() + static_cast<size_t>(height - 1 - row) * stride, stride);
  }
  return true;
}


HGLOBAL CopyToGlobal(const void* data, size_t size) {
  HGLOBAL memory = ::GlobalAlloc(GMEM_MOVEABLE, size);
  if (memory == nullptr) return nullptr;
  void* target = ::GlobalLock(memory);
  if (target == nullptr) {
    ::GlobalFree(memory);
    return nullptr;
  }
  std::memcpy(target, data, size);
  ::GlobalUnlock(memory);
  return memory;
}

}  // namespace

bool ReadClipboardPng(std::vector<uint8_t>* png, std::string* error) {
  png->clear();
  ClipboardLock lock;
  if (!lock.ok()) {
    *error = "cannot open the clipboard";
    return false;
  }

  // 優先讀 "PNG" 格式：不經過重新編碼，透明度也完整
  const UINT png_format = ::RegisterClipboardFormatW(L"PNG");
  if (::IsClipboardFormatAvailable(png_format)) {
    HANDLE handle = ::GetClipboardData(png_format);
    if (handle != nullptr) {
      const SIZE_T length = ::GlobalSize(handle);
      const void* source = ::GlobalLock(handle);
      if (source != nullptr) {
        png->assign(static_cast<const uint8_t*>(source), static_cast<const uint8_t*>(source) + length);
        ::GlobalUnlock(handle);
        return true;
      }
    }
  }

  if (!::IsClipboardFormatAvailable(CF_DIB)) {
    return true;  // 沒有圖片
  }
  HANDLE handle = ::GetClipboardData(CF_DIB);
  if (handle == nullptr) return true;
  const SIZE_T length = ::GlobalSize(handle);
  const uint8_t* dib = static_cast<const uint8_t*>(::GlobalLock(handle));
  if (dib == nullptr || length < sizeof(BITMAPINFOHEADER)) {
    if (dib != nullptr) ::GlobalUnlock(handle);
    return true;
  }
  const std::vector<uint8_t> bmp = DibToBmp(dib, length);
  ::GlobalUnlock(handle);

  ComPtr<IWICImagingFactory> factory = CreateFactory();
  if (!factory) {
    *error = "cannot create the imaging factory";
    return false;
  }
  if (!EncodePng(factory.Get(), bmp.data(), bmp.size(), png)) {
    png->clear();
    *error = "cannot convert the clipboard image to PNG";
    return false;
  }
  return true;
}

bool WriteClipboardImage(const std::vector<uint8_t>& bytes, bool is_png, std::string* error) {
  ComPtr<IWICImagingFactory> factory = CreateFactory();
  if (!factory) {
    *error = "cannot create the imaging factory";
    return false;
  }
  std::vector<uint8_t> dib;
  if (!DecodeToDib(factory.Get(), bytes, &dib)) {
    *error = "cannot decode the image";
    return false;
  }

  ClipboardLock lock;
  if (!lock.ok()) {
    *error = "cannot open the clipboard";
    return false;
  }
  ::EmptyClipboard();

  HGLOBAL dib_memory = CopyToGlobal(dib.data(), dib.size());
  if (dib_memory == nullptr || ::SetClipboardData(CF_DIB, dib_memory) == nullptr) {
    if (dib_memory != nullptr) ::GlobalFree(dib_memory);
    *error = "cannot write the clipboard";
    return false;
  }
  if (is_png) {
    HGLOBAL png_memory = CopyToGlobal(bytes.data(), bytes.size());
    const UINT png_format = ::RegisterClipboardFormatW(L"PNG");
    if (png_memory != nullptr && ::SetClipboardData(png_format, png_memory) == nullptr) {
      ::GlobalFree(png_memory);  // CF_DIB 已放進去，PNG 失敗不算整體失敗
    }
  }
  return true;
}

}  // namespace aqutter_shell
