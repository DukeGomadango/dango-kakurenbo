import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { siteMetadata } from "@/lib/site-metadata";

export const alt = siteMetadata.title;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

async function loadFont(filename: string) {
  return readFile(join(process.cwd(), "src/app/fonts", filename));
}

function DangoIcon({
  scale = 1,
  hidden = false,
}: {
  scale?: number;
  hidden?: boolean;
}) {
  const w = Math.round(100 * scale);
  const h = Math.round(150 * scale);
  const topSize = Math.round(88 * scale);
  const midSize = Math.round(96 * scale);
  const botSize = Math.round(88 * scale);
  const midTop = Math.round(52 * scale);
  const border = Math.max(3, Math.round(5 * scale));

  const topFill = hidden ? "transparent" : "#8b5cf6";
  const midFill = hidden ? "transparent" : "#f4f4f7";
  const botFill = hidden ? "transparent" : "#7c3aed";

  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        width: w,
        height: h,
        flexShrink: 0,
      }}
    >
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: Math.round((w - botSize) / 2),
          width: botSize,
          height: botSize,
          borderRadius: "50%",
          backgroundColor: botFill,
          border: `${border}px solid #4c1d95`,
        }}
      />
      <div
        style={{
          position: "absolute",
          top: midTop,
          left: Math.round((w - midSize) / 2),
          width: midSize,
          height: midSize,
          borderRadius: "50%",
          backgroundColor: midFill,
          border: `${border}px solid #71717a`,
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 0,
          left: Math.round((w - topSize) / 2),
          width: topSize,
          height: topSize,
          borderRadius: "50%",
          backgroundColor: topFill,
          border: `${border}px solid #5b21b6`,
        }}
      />
    </div>
  );
}

export default async function Image() {
  const fontBold = await loadFont("NotoSansJP-Bold.woff");

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 88px",
          backgroundColor: "#06050b",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            background:
              "radial-gradient(circle at 18% 50%, rgba(139, 92, 246, 0.42) 0%, transparent 58%), radial-gradient(circle at 82% 28%, rgba(236, 72, 153, 0.26) 0%, transparent 50%), radial-gradient(circle at 68% 82%, rgba(59, 130, 246, 0.2) 0%, transparent 45%)",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: -80,
              left: -60,
              width: 420,
              height: 420,
              borderRadius: "50%",
              background: "rgba(139, 92, 246, 0.18)",
            }}
          />
          <div
            style={{
              position: "absolute",
              bottom: -100,
              right: -80,
              width: 380,
              height: 380,
              borderRadius: "50%",
              background: "rgba(236, 72, 153, 0.12)",
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              opacity: 0.04,
              backgroundImage:
                "linear-gradient(#f4f4f7 1px, transparent 1px), linear-gradient(90deg, #f4f4f7 1px, transparent 1px)",
              backgroundSize: "40px 40px",
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "radial-gradient(circle at 50% 50%, transparent 55%, rgba(6, 5, 11, 0.42) 100%)",
            }}
          />
        </div>

        <div
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 320,
            height: 320,
          }}
        >
          <div
            style={{
              position: "absolute",
              width: 240,
              height: 240,
              borderRadius: "50%",
              background: "rgba(139, 92, 246, 0.16)",
            }}
          />
          <div
            style={{
              position: "absolute",
              left: 4,
              top: 52,
              display: "flex",
              opacity: 0.55,
            }}
          >
            <DangoIcon scale={0.95} hidden />
          </div>
          <div
            style={{
              position: "absolute",
              left: 52,
              top: 8,
              display: "flex",
            }}
          >
            <DangoIcon scale={1.75} />
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 4,
            marginRight: 24,
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: 108,
              fontWeight: 700,
              color: "#f4f4f7",
              fontFamily: "Noto Sans JP",
              letterSpacing: "-0.03em",
              lineHeight: 0.95,
            }}
          >
            だんご
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 108,
              fontWeight: 700,
              color: "#a78bfa",
              fontFamily: "Noto Sans JP",
              letterSpacing: "-0.03em",
              lineHeight: 0.95,
              marginLeft: 72,
            }}
          >
            かくれんぼ
          </div>
          <div
            style={{
              display: "flex",
              marginTop: 28,
              marginLeft: 8,
              width: 280,
              height: 4,
              borderRadius: 999,
              background:
                "linear-gradient(90deg, rgba(139, 92, 246, 0.9) 0%, rgba(236, 72, 153, 0.45) 100%)",
            }}
          />
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        {
          name: "Noto Sans JP",
          data: fontBold,
          weight: 700,
          style: "normal",
        },
      ],
    },
  );
}
