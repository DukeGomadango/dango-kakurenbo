import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";
export const runtime = "edge";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#06050b",
        }}
      >
        <div
          style={{
            position: "relative",
            display: "flex",
            width: 72,
            height: 108,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              position: "absolute",
              bottom: 0,
              width: 64,
              height: 64,
              borderRadius: "50%",
              backgroundColor: "#7c3aed",
              border: "4px solid #4c1d95",
            }}
          />
          <div
            style={{
              position: "absolute",
              top: 38,
              width: 70,
              height: 70,
              borderRadius: "50%",
              backgroundColor: "#f4f4f7",
              border: "4px solid #71717a",
            }}
          />
          <div
            style={{
              position: "absolute",
              top: 0,
              width: 64,
              height: 64,
              borderRadius: "50%",
              backgroundColor: "#8b5cf6",
              border: "4px solid #5b21b6",
            }}
          />
        </div>
      </div>
    ),
    { ...size },
  );
}
