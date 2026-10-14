(function () {
  let modalEl = null;

  function buildModal() {
    const overlay = document.createElement('div');
    overlay.className = 'cropper-overlay';
    overlay.innerHTML = `
      <div class="cropper-card">
        <p class="cropper-title">Adjust your image</p>
        <div class="cropper-viewport">
          <img class="cropper-image" alt="" draggable="false">
          <div class="cropper-mask"></div>
        </div>
        <input type="range" class="cropper-zoom" min="1" max="3" step="0.01" value="1">
        <div class="cropper-actions">
          <button type="button" class="action-button action-button--small cropper-cancel">Cancel</button>
          <button type="button" class="action-button action-button--small cropper-apply">Apply</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    return overlay;
  }

  window.openImageCropper = function openImageCropper(file, opts) {
    opts = opts || {};
    const aspect = opts.aspect || 1;
    const circle = !!opts.circle;
    const outputWidth = opts.outputWidth || (circle ? 512 : 1200);
    const outputHeight = opts.outputHeight || Math.round(outputWidth / aspect);

    return new Promise((resolve) => {
      if (modalEl) modalEl.remove();
      modalEl = buildModal();

      const viewport = modalEl.querySelector('.cropper-viewport');
      const imageEl = modalEl.querySelector('.cropper-image');
      const mask = modalEl.querySelector('.cropper-mask');
      const zoomSlider = modalEl.querySelector('.cropper-zoom');
      const cancelButton = modalEl.querySelector('.cropper-cancel');
      const applyButton = modalEl.querySelector('.cropper-apply');

      mask.classList.toggle('cropper-mask--circle', circle);

      const viewportWidth = 320;
      const viewportHeight = Math.round(viewportWidth / aspect);
      viewport.style.width = `${viewportWidth}px`;
      viewport.style.height = `${viewportHeight}px`;

      const objectUrl = URL.createObjectURL(file);
      let naturalWidth = 0;
      let naturalHeight = 0;
      let baseScale = 1;
      let scale = 1;
      let offsetX = 0;
      let offsetY = 0;

      function applyTransform() {
        imageEl.style.width = `${naturalWidth * scale}px`;
        imageEl.style.height = `${naturalHeight * scale}px`;
        imageEl.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
      }

      function clampOffsets() {
        const scaledWidth = naturalWidth * scale;
        const scaledHeight = naturalHeight * scale;
        const minX = viewportWidth - scaledWidth;
        const minY = viewportHeight - scaledHeight;
        offsetX = Math.min(0, Math.max(minX, offsetX));
        offsetY = Math.min(0, Math.max(minY, offsetY));
      }

      function cleanup(result) {
        URL.revokeObjectURL(objectUrl);
        modalEl.remove();
        modalEl = null;
        resolve(result);
      }

      imageEl.onload = () => {
        naturalWidth = imageEl.naturalWidth;
        naturalHeight = imageEl.naturalHeight;
        baseScale = Math.max(viewportWidth / naturalWidth, viewportHeight / naturalHeight);
        scale = baseScale;
        offsetX = (viewportWidth - naturalWidth * scale) / 2;
        offsetY = (viewportHeight - naturalHeight * scale) / 2;
        zoomSlider.value = '1';
        applyTransform();
      };
      imageEl.src = objectUrl;

      zoomSlider.addEventListener('input', () => {
        const zoomFactor = parseFloat(zoomSlider.value);
        const centerX = viewportWidth / 2;
        const centerY = viewportHeight / 2;
        const sourceX = (centerX - offsetX) / scale;
        const sourceY = (centerY - offsetY) / scale;

        scale = baseScale * zoomFactor;
        offsetX = centerX - sourceX * scale;
        offsetY = centerY - sourceY * scale;
        clampOffsets();
        applyTransform();
      });

      let dragging = false;
      let dragStartX = 0;
      let dragStartY = 0;
      let startOffsetX = 0;
      let startOffsetY = 0;

      function pointerDown(clientX, clientY) {
        dragging = true;
        dragStartX = clientX;
        dragStartY = clientY;
        startOffsetX = offsetX;
        startOffsetY = offsetY;
      }

      function pointerMove(clientX, clientY) {
        if (!dragging) return;
        offsetX = startOffsetX + (clientX - dragStartX);
        offsetY = startOffsetY + (clientY - dragStartY);
        clampOffsets();
        applyTransform();
      }

      function pointerUp() {
        dragging = false;
      }

      viewport.addEventListener('mousedown', (event) => {
        event.preventDefault();
        pointerDown(event.clientX, event.clientY);
      });
      window.addEventListener('mousemove', (event) => pointerMove(event.clientX, event.clientY));
      window.addEventListener('mouseup', pointerUp);

      viewport.addEventListener('touchstart', (event) => {
        const touch = event.touches[0];
        pointerDown(touch.clientX, touch.clientY);
      }, { passive: true });
      viewport.addEventListener('touchmove', (event) => {
        const touch = event.touches[0];
        pointerMove(touch.clientX, touch.clientY);
      }, { passive: true });
      viewport.addEventListener('touchend', pointerUp);

      cancelButton.addEventListener('click', () => cleanup(null));
      modalEl.addEventListener('click', (event) => {
        if (event.target === modalEl) cleanup(null);
      });

      applyButton.addEventListener('click', () => {
        const canvas = document.createElement('canvas');
        canvas.width = outputWidth;
        canvas.height = outputHeight;
        const ctx = canvas.getContext('2d');

        const srcX = -offsetX / scale;
        const srcY = -offsetY / scale;
        const srcWidth = viewportWidth / scale;
        const srcHeight = viewportHeight / scale;

        ctx.drawImage(imageEl, srcX, srcY, srcWidth, srcHeight, 0, 0, outputWidth, outputHeight);

        canvas.toBlob((blob) => cleanup(blob), 'image/jpeg', 0.92);
      });
    });
  };
})();
