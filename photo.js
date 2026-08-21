// ===============================================
// 사진 압축 공용 모듈
//  window.compressImage(file) → JPEG dataURL
//  최대 1024px, 목표 150KB 이하가 될 때까지 품질을 낮춥니다.
// ===============================================
(function () {
  async function compressImage(file, maxDim = 1024, targetKB = 150) {
    const dataUrl = await new Promise((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => res(fr.result);
      fr.onerror = rej;
      fr.readAsDataURL(file);
    });
    const img = await new Promise((res, rej) => {
      const im = new Image();
      im.onload = () => res(im);
      im.onerror = rej;
      im.src = dataUrl;
    });
    const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
    let quality = 0.7;
    let out = canvas.toDataURL("image/jpeg", quality);
    while (out.length * 0.75 > targetKB * 1024 && quality > 0.4) {
      quality -= 0.1;
      out = canvas.toDataURL("image/jpeg", quality);
    }
    return out;
  }
  window.compressImage = compressImage;
})();
