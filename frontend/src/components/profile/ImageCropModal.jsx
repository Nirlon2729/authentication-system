import { useState, useCallback } from "react";
import Cropper from "react-easy-crop";

import getCroppedImg from "../../utils/cropImage";

const ImageCropModal = ({
  image,
  onCancel,
  onSave,
}) => {
  const [crop, setCrop] = useState({
    x: 0,
    y: 0,
  });

  const [zoom, setZoom] =
    useState(1);

  const [croppedAreaPixels, setCroppedAreaPixels] =
    useState(null);

  const onCropComplete =
    useCallback(
      (
        croppedArea,
        croppedAreaPixels
      ) => {
        setCroppedAreaPixels(
          croppedAreaPixels
        );
      },
      []
    );

  const handleSave =
    async () => {
      const croppedImage =
        await getCroppedImg(
          image,
          croppedAreaPixels
        );

      onSave(croppedImage);
    };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background:
          "rgba(0,0,0,.75)",
        display: "flex",
        justifyContent:
          "center",
        alignItems: "center",
        zIndex: 9999,
      }}
    >
      <div
        style={{
          width: "500px",
          background: "#fff",
          borderRadius: "16px",
          padding: "20px",
        }}
      >
        <h2>
          Crop Profile Picture
        </h2>

        <div
          style={{
            position: "relative",
            width: "100%",
            height: "350px",
            marginTop: "20px",
          }}
        >
          <Cropper
            image={image}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape="round"
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={
              onCropComplete
            }
          />
        </div>

        <div
          style={{
            marginTop: "25px",
          }}
        >
          <label>
            Zoom
          </label>

          <input
            type="range"
            min={1}
            max={3}
            step={0.1}
            value={zoom}
            onChange={(e) =>
              setZoom(
                e.target.value
              )
            }
            style={{
              width: "100%",
            }}
          />
        </div>

        <div
          style={{
            display: "flex",
            justifyContent:
              "flex-end",
            gap: "12px",
            marginTop: "25px",
          }}
        >
          <button
            onClick={onCancel}
          >
            Cancel
          </button>

          <button
            onClick={handleSave}
          >
            Upload
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImageCropModal;