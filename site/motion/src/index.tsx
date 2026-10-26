import React from "react";
import {
  AbsoluteFill,
  Composition,
  Easing,
  Img,
  interpolate,
  registerRoot,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { launch, proof } from "./records";
import captionBeats from "../captions.json";
import shortCaptionBeats from "../captions-short.json";
const captions = captionBeats.map((beat) => beat.text);
import "./style.css";

const C = {
  bg: "#12110f",
  fg: "#f4f0e8",
  surface: "#1c1a17",
  line: "#3b3830",
  muted: "#9a948a",
  amber: "#ffaa1c",
  red: "#ff6b5e",
  green: "#009e73",
};
const clamp = (x: number) => Math.min(1, Math.max(0, x));
const move = (f: number, start: number, duration = 9) =>
  Easing.bezier(0.16, 1, 0.3, 1)(clamp((f - start) / duration));
const textStyle: React.CSSProperties = {
  fontSize: 39,
  fontWeight: 600,
  letterSpacing: "-.015em",
};
const Lamp = ({ on = true, width = 100 }: { on?: boolean; width?: number }) => (
  <svg width={width} height={width * 0.65} viewBox="0 0 100 65">
    <circle cx="73" cy="12" r="9" fill={on ? C.amber : C.muted} />
    <path d="M8 35H92V49H8Z" fill={C.fg} />
  </svg>
);
const Tag = ({ children }: { children: React.ReactNode }) => (
  <div
    style={{
      fontSize: 25,
      color: C.muted,
      letterSpacing: ".06em",
      textTransform: "uppercase",
    }}
  >
    {children}
  </div>
);
const Card = ({
  children,
  style = {},
}: {
  children?: React.ReactNode;
  style?: React.CSSProperties;
}) => (
  <div
    style={{
      background: C.surface,
      border: `2px solid ${C.line}`,
      borderRadius: 12,
      ...style,
    }}
  >
    {children}
  </div>
);
const Stamp = ({
  label = "SIGN-OFF",
  opacity = 1,
}: {
  label?: string;
  opacity?: number;
}) => (
  <div
    style={{
      border: `4px solid ${C.fg}`,
      padding: "14px 26px",
      fontSize: 39,
      fontWeight: 600,
      transform: "rotate(-7deg)",
      opacity,
      letterSpacing: ".02em",
    }}
  >
    {label}
  </div>
);
const Folder = ({
  x = 0,
  y = 0,
  scale = 1,
}: {
  x?: number;
  y?: number;
  scale?: number;
}) => (
  <div
    style={{
      position: "absolute",
      left: x,
      top: y,
      transform: `scale(${scale})`,
      width: 110,
      height: 76,
      background: C.fg,
      borderRadius: 5,
    }}
  >
    <div
      style={{
        position: "absolute",
        left: 0,
        top: -15,
        width: 48,
        height: 20,
        borderRadius: 5,
        background: C.fg,
      }}
    />
    <div
      style={{
        position: "absolute",
        inset: "22px 18px",
        borderTop: `3px solid ${C.bg}`,
        borderBottom: `3px solid ${C.bg}`,
      }}
    />
  </div>
);
const Brief = ({ f }: { f: number }) => {
  const brief = "LinkedIn launch card for Desk Studio, dark, one line of copy.";
  const fold = move(f, 125, 18);
  return (
    <>
      <div
        style={{
          position: "absolute",
          left: 200 + fold * 550,
          top: 220 + fold * 80,
          width: 1520 - fold * 1120,
          transform: `translateY(${-fold * 45}px)`,
        }}
      >
        <div style={{ opacity: 1 - fold }}>
          <Tag>Brief</Tag>
        </div>
        <Card
          style={{
            marginTop: 24,
            padding: 64,
            height: 280,
            overflow: "hidden",
            borderRadius: 12 + fold * 12,
          }}
        >
          <div
            style={{
              fontSize: 64,
              fontWeight: 600,
              lineHeight: 1.18,
              opacity: 1 - fold,
            }}
          >
            {brief.slice(0, Math.floor(clamp((f - 15) / 95) * brief.length))}
            <span style={{ opacity: f < 120 ? 1 : 0 }}>▏</span>
          </div>
          <div
            style={{ opacity: fold, position: "absolute", top: 100, left: 150 }}
          >
            <Lamp width={100} />
          </div>
        </Card>
      </div>
      <div style={{ position: "absolute", left: 790, top: 570, opacity: fold }}>
        <Tag>Job</Tag>
      </div>
    </>
  );
};
const Pipeline = ({ f }: { f: number }) => {
  const roles = ["Roughs", "Pick", "Polish", "Proof", "Sign-off"];
  const active = Math.min(4, Math.max(0, Math.floor((f - 20) / 48)));
  const x = interpolate(
    f,
    [20, 68, 116, 164, 212],
    [245, 565, 885, 1205, 1525],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  return (
    <>
      <div
        style={{
          position: "absolute",
          left: 190,
          right: 190,
          top: 322,
          height: 2,
          background: C.line,
        }}
      />
      {roles.map((name, i) => (
        <div
          key={name}
          style={{
            position: "absolute",
            left: 160 + i * 320,
            top: 265,
            width: 280,
            textAlign: "center",
            opacity: 0.35 + 0.65 * move(f, 10 + i * 48),
          }}
        >
          <Lamp on={i <= active} width={140} />
          <div style={{ ...textStyle, marginTop: 26 }}>{name}</div>
        </div>
      ))}
      <Folder x={x} y={460} />
      <div
        style={{
          position: "absolute",
          left: 150,
          top: 635,
          display: "flex",
          gap: 22,
        }}
      >
        {[0, 1, 2].map((v) => (
          <Card
            key={v}
            style={{
              width: 210,
              height: 110,
              opacity: f > 74 && v !== 1 ? 0.18 : move(f, 25 + v * 3),
              transform: `rotate(${(v - 1) * 5}deg)`,
            }}
          >
            <div
              style={{
                margin: "30px 24px",
                width: v === 1 ? 135 : 95,
                height: 14,
                background: C.fg,
              }}
            />
          </Card>
        ))}
      </div>
      {f > 70 && (
        <svg
          style={{ position: "absolute", left: 385, top: 620 }}
          width="236"
          height="146"
        >
          <ellipse
            cx="118"
            cy="73"
            rx="111"
            ry="65"
            fill="none"
            stroke={C.amber}
            strokeWidth="4"
            pathLength="1"
            strokeDasharray="1"
            strokeDashoffset={1 - move(f, 74, 12)}
          />
        </svg>
      )}
      <div
        style={{
          position: "absolute",
          left: 820,
          top: 635,
          opacity: move(f, 116),
        }}
      >
        <div
          style={{
            width: 230,
            height: 8,
            background: C.fg,
            transform: `translateY(${(1 - move(f, 125)) * 25}px)`,
          }}
        />
        <div
          style={{ width: 150, height: 8, background: C.muted, marginTop: 22 }}
        />
      </div>
      <div
        style={{
          position: "absolute",
          left: 1190,
          top: 635,
          width: 190,
          height: 74,
          opacity: move(f, 164),
          borderTop: `3px solid ${C.fg}`,
          background:
            "repeating-linear-gradient(90deg,transparent,transparent 18px,#9a948a 19px,#9a948a 20px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 1440,
          top: 655,
          opacity: move(f, 218),
        }}
      >
        <Stamp />
      </div>
    </>
  );
};
const Proof = ({ f }: { f: number }) => {
  const fix = move(f, 155, 18),
    success = f > 185;
  const measuredTop = proof.actualTop + (proof.safeTop + 22 - proof.actualTop) * fix;
  const y = measuredTop * 0.92;
  return (
    <>
      <div
        style={{
          position: "absolute",
          left: 410,
          top: 135,
          display: "flex",
          alignItems: "center",
          gap: 40,
        }}
      >
        <Tag>Proof</Tag>
        <div style={{ ...textStyle }}>1200 × 627</div>
      </div>
      <div
        style={{
          position: "absolute",
          left: 410 - Math.sin(clamp((f - 110) / 75) * Math.PI) * 100,
          top: 205,
          width: 1104,
          height: 577,
          background: C.surface,
          border: `2px solid ${C.line}`,
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 35,
            right: 35,
            top: proof.safeTop * 0.92,
            borderTop: `3px dashed ${success ? C.green : C.red}`,
            opacity: move(f, 20),
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 60,
            top: y,
            fontSize: 25,
            fontWeight: 400,
          }}
        >
          deskstudio.ai
        </div>
        <div
          style={{
            position: "absolute",
            left: 60,
            top: 180,
            fontSize: 76.5,
            fontWeight: 600,
            lineHeight: 1.05,
            width: 780,
          }}
        >
          Your own
          <br />
          design studio.
        </div>
        <div style={{ position: "absolute", right: 60, bottom: 42 }}>
          <Lamp width={110} />
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          left: 460,
          top: 370,
          width: 1000,
          opacity: move(f, 32),
          background: C.surface,
          border: `2px solid ${C.line}`,
          boxShadow: `0 12px 40px ${C.bg}`,
        }}
      >
        <div style={{ fontSize: 25, padding: "16px 24px", color: C.muted }}>
          2× · top-left
        </div>
        <svg width="996" height="320" viewBox="0 0 498 160">
          <path d="M0 0H498" stroke={C.fg} strokeWidth="2" />
          {!success && (
            <rect x="35" y={proof.actualTop} width="440"
              height={proof.safeTop - proof.actualTop} fill={C.red} opacity=".25" />
          )}
          <path d={`M35 ${proof.safeTop}H475`} fill="none"
            stroke={success ? C.green : C.red} strokeWidth="1.5" strokeDasharray="5 4" />
          <text x="60" y={measuredTop - 5} dominantBaseline="text-before-edge"
            fill={C.fg} fontSize="25" fontFamily="Inter">deskstudio.ai</text>
          <path d={`M290 0V${measuredTop}m-6 0h12M284 0h12`}
            fill="none" stroke={success ? C.green : C.red} strokeWidth="2" />
          <path d={`M400 0V${proof.safeTop}m-6 0h12M394 0h12`}
            fill="none" stroke={C.muted} strokeWidth="2" />
          <text x="290" y="100" textAnchor="middle" fill={success ? C.green : C.red}
            fontSize="25" fontFamily="Inter">{success ? "PASS" : "32 px"}</text>
          <text x="400" y="100" textAnchor="middle" fill={C.fg}
            fontSize="25" fontFamily="Inter">38 px</text>
          <text x="400" y="125" textAnchor="middle" fill={C.muted}
            fontSize="16" fontFamily="Inter">safe zone</text>
        </svg>
      </div>
      <div
        style={{
          position: "absolute",
          left: 1550,
          top: 225,
          opacity: move(f, 35),
          width: 300,
        }}
      >
        <div
          style={{
            fontSize: 76.5,
            fontWeight: 600,
            color: success ? C.green : C.red,
          }}
        >
          {success ? "PASS" : "32 px"}
        </div>
        <div style={{ fontSize: 25, color: C.muted, marginTop: 16 }}>
          38 px safe zone
        </div>
        <div style={{ fontSize: 25, marginTop: 80, opacity: f > 105 ? 1 : 0 }}>
          {success ? "Proof" : "← Polish"}
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          left: 410,
          top: 802,
          fontSize: 20,
          color: C.muted,
        }}
      >
        Dashboard job · {proof.id}
      </div>
    </>
  );
};
const Rubric = ({ f }: { f: number }) => {
  const round =
    f < 125 ? launch.scores[0] : f < 175 ? launch.scores[1] : launch.scores[2];
  const axes = Object.entries(round.axes);
  const previous = f < 125 ? launch.scores[0] : launch.scores[1];
  return (
    <>
      <div style={{ position: "absolute", left: 160, top: 160 }}>
        <Tag>Sign-off</Tag>
        <div style={{ fontSize: 76.5, fontWeight: 600, marginTop: 14 }}>
          Round {round.round}
        </div>
        <div
          style={{
            fontSize: 160,
            fontWeight: 600,
            lineHeight: 1.1,
            marginTop: 40,
          }}
        >
          {round.average.toFixed(1)}
        </div>
        <div
          style={{
            fontSize: 25,
            color: round.pass ? C.fg : C.red,
            marginTop: 16,
          }}
        >
          {round.pass ? "Every axis ≥ 8" : "Held"}
        </div>
        <div
          style={{
            width: 400,
            height: 2,
            background: C.line,
            marginTop: 40,
            position: "relative",
          }}
        >
          <div
            style={{
              position: "absolute",
              left: "85%",
              top: -12,
              height: 26,
              borderLeft: `2px solid ${C.fg}`,
            }}
          />
          <div
            style={{
              height: 4,
              width: `${round.average * 10}%`,
              background: C.fg,
            }}
          />
        </div>
        <div style={{ fontSize: 25, color: C.muted, marginTop: 24 }}>
          Average ≥ 8.5
        </div>
        <div style={{ marginTop: 60, opacity: round.pass ? move(f, 200) : 0 }}>
          <Stamp />
        </div>
      </div>
      <div style={{ position: "absolute", left: 720, right: 160, top: 170 }}>
        {axes.map(([axis, value], i) => {
          const v =
            f >= 175
              ? Number(previous.axes[axis as keyof typeof previous.axes]) +
                (value -
                  Number(previous.axes[axis as keyof typeof previous.axes])) *
                  move(f, 175 + i * 1.8)
              : value;
          return (
            <div
              key={axis}
              style={{
                display: "grid",
                gridTemplateColumns: "240px 1fr 60px",
                alignItems: "center",
                gap: 22,
                marginBottom: 24,
                fontSize: 25,
              }}
            >
              <div style={{ textTransform: "capitalize" }}>{axis}</div>
              <div
                style={{
                  height: 38,
                  position: "relative",
                  background: C.surface,
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: `${v * 10}%`,
                    background: value < 8 ? C.muted : C.fg,
                    transform: `scaleX(${move(f, 16 + i * 1.8)})`,
                    transformOrigin: "left",
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    left: "80%",
                    top: -6,
                    bottom: -6,
                    borderLeft: `2px solid ${C.muted}`,
                  }}
                />
              </div>
              <div style={{ color: value < 8 ? C.red : C.fg }}>
                {Math.round(v)}
              </div>
            </div>
          );
        })}
        <div style={{ fontSize: 20, color: C.muted, marginTop: 40 }}>
          Launch-card job · 20261019-0025
        </div>
      </div>
    </>
  );
};
const Outputs = ({ f }: { f: number }) => {
  const assets = [
    ["launch.png", "LinkedIn card"],
    ["dashboard.png", "Dashboard"],
    ["article.png", "Article cover"],
  ];
  return (
    <>
      <div style={{ position: "absolute", left: 160, top: 160 }}>
        <Tag>Signed off</Tag>
      </div>
      {assets.map(([file, label], i) => (
        <div
          key={file}
          style={{
            position: "absolute",
            left: 165 + i * 540,
            top: 285 + (1 - move(f, i * 3)) * 24,
            width: 510,
            opacity: move(f, i * 3),
            transform: `rotate(${(i - 1) * 2}deg)`,
          }}
        >
          <Img
            src={staticFile(`assets/${file}`)}
            style={{
              width: 510,
              height: 310,
              objectFit: "contain",
              background: C.surface,
              border: `2px solid ${C.line}`,
            }}
          />
          <div style={{ fontSize: 25, marginTop: 26 }}>{label}</div>
        </div>
      ))}
      <div
        style={{
          position: "absolute",
          left: 160,
          right: 160,
          bottom: 230,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "end",
        }}
      >
        <div style={{ fontSize: 25, color: C.muted }}>
          Launch card · three rounds
        </div>
        <div style={{ fontSize: 76.5, fontWeight: 600 }}>
          ${(launch.cost.total * move(f, 80, 60)).toFixed(2)}
        </div>
      </div>
    </>
  );
};
const Hosts = ({ f }: { f: number }) => {
  const cmd = "npx -y deskstudio add";
  return (
    <>
      <div
        style={{
          position: "absolute",
          left: 250,
          top: 205,
          right: 250,
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontFamily: "Geist Mono",
            fontSize: 51,
            padding: "30px 35px",
            borderBottom: `2px solid ${C.line}`,
            textAlign: "left",
          }}
        >
          <span style={{ color: C.muted }}>$ </span>
          {cmd.slice(0, Math.floor(clamp(f / 45) * cmd.length))}
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 50,
            marginTop: 65,
          }}
        >
          {[
            ["claudecode", "Claude Code"],
            ["codex", "Codex"],
            ["geminicli", "Gemini CLI"],
            ["githubcopilot", "Copilot"],
          ].map(([file, label], i) => (
            <div
              key={label}
              style={{
                width: 290,
                opacity: move(f, 50 + i * 2),
                transform: `translateY(${(1 - move(f, 50 + i * 2)) * 24}px)`,
              }}
            >
              <Img
                src={staticFile(`assets/${file}.svg`)}
                style={{
                  width: 70,
                  height: 70,
                  filter: "brightness(0) invert(1)",
                }}
              />
              <div style={{ fontSize: 25, marginTop: 22 }}>{label}</div>
            </div>
          ))}
        </div>
        <Img
          src={staticFile("assets/lockup-on-dark.svg")}
          style={{
            width: 440,
            height: 125,
            objectFit: "contain",
            marginTop: 80,
          }}
        />
        <div style={{ fontSize: 20, color: C.muted, marginTop: 20 }}>
          Terminal-host runs · 2026-10-20 · npm 1.0.0
        </div>
      </div>
    </>
  );
};
const starts = [0, 180, 480, 780, 1080, 1320];
const lengths = [180, 300, 300, 300, 240, 180];
const scenes = [Brief, Pipeline, Proof, Rubric, Outputs, Hosts];
export const Explainer = ({ short = false }: { short?: boolean }) => {
  const frame = useCurrentFrame();
  const i = short
    ? frame < 100
      ? 1
      : frame < 200
        ? 2
        : 3
    : Math.max(
        0,
        starts.findLastIndex((s) => frame >= s),
      );
  const local = short ? (frame % 100) * 3 : frame - starts[i];
  const Scene = scenes[i];
  const duration = short ? 100 : lengths[i];
  const phase = short ? frame % 100 : local;
  const opacity = Math.min(
    move(phase, 0, short ? 4 : 9),
    1 - clamp((phase - (duration - 7)) / 6),
  );
  return (
    <AbsoluteFill
      style={{
        background: C.bg,
        color: C.fg,
        fontFamily: "Inter",
        fontVariantNumeric: "tabular-nums",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 80,
          top: 55,
          display: "flex",
          alignItems: "center",
          gap: 20,
        }}
      >
        <Lamp width={58} />
        <span
          style={{ fontSize: 25, fontWeight: 600, letterSpacing: "-.02em" }}
        >
          Desk Studio
        </span>
      </div>
      <div
        style={{
          position: "absolute",
          right: 80,
          top: 73,
          fontSize: 20,
          color: C.muted,
          opacity,
        }}
      >
        0{i + 1} / 06
      </div>
      <AbsoluteFill style={{ opacity }}>
        <Scene f={local} />
        <div
          style={{
            position: "absolute",
            bottom: 72,
            left: 160,
            right: 160,
            fontSize: 39,
            fontWeight: 400,
            lineHeight: 1.3,
            maxWidth: 1550,
          }}
        >
          {short ? shortCaptionBeats[i - 1].text : captions[i]}
        </div>
      </AbsoluteFill>
      <div
        style={{
          position: "absolute",
          left: 80,
          right: 80,
          bottom: 34,
          height: 2,
          background: C.line,
        }}
      >
        <div
          style={{
            height: 2,
            width: `${(short ? frame / 299 : frame / 1499) * 100}%`,
            background: C.muted,
            opacity,
          }}
        />
      </div>
    </AbsoluteFill>
  );
};
const Root = () => (
  <>
    <Composition
      id="Explainer"
      component={Explainer}
      durationInFrames={1500}
      fps={30}
      width={1920}
      height={1080}
    />
    <Composition
      id="ExplainerShort"
      component={Explainer}
      defaultProps={{ short: true }}
      durationInFrames={300}
      fps={30}
      width={1920}
      height={1080}
    />
  </>
);
registerRoot(Root);
