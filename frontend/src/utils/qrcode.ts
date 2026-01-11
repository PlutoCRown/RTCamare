/**
 * 二维码生成工具函数
 */

/**
 * 生成二维码的 Data URL
 * @param url 要编码的 URL
 * @param options 二维码选项
 * @returns Promise<string> 返回二维码的 Data URL
 */
export async function generateQRCodeDataUrl(
  url: string,
  options?: {
    width?: number;
    margin?: number;
    color?: {
      dark?: string;
      light?: string;
    };
  }
): Promise<string> {
  try {
    const QRCode = await import("qrcode");
    const dataUrl = await QRCode.toDataURL(url, {
      width: options?.width || 200,
      margin: options?.margin || 2,
      color: {
        dark: options?.color?.dark || "#000000",
        light: options?.color?.light || "#FFFFFF",
      },
    });
    return dataUrl;
  } catch (error) {
    console.error("Failed to generate QR code:", error);
    throw error;
  }
}
