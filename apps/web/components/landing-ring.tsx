/**
 * The idea, as one picture: eight people around a circle, one of them
 * collecting this round, the ones who have paid already ticked.
 *
 * Static and server-rendered — it is an illustration, not the live circle view,
 * so it costs nothing and it is the first thing a visitor understands.
 */
export function LandingRing({ size = 232 }: { size?: number }) {
  const count = 8
  const collector = 0
  const paid = 4
  const centre = size / 2
  const radius = size / 2 - 24
  const dot = size * 0.055

  return (
    <div className="mx-auto w-full" style={{ maxWidth: size }}>
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="h-auto w-full"
        role="img"
        aria-label="Eight members around a circle. One collects this round; four have already paid in."
      >
        <defs>
          <linearGradient id="lr-gold" x1="0" y1="0" x2={size} y2={size} gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#FFD98A" />
            <stop offset="0.5" stopColor="#FFC24A" />
            <stop offset="1" stopColor="#E8734A" />
          </linearGradient>
        </defs>

        <circle
          cx={centre}
          cy={centre}
          r={radius}
          fill="none"
          stroke="rgba(246,241,233,0.10)"
          strokeWidth="1.5"
          strokeDasharray="3 8"
        />

        <text
          x={centre}
          y={centre - 14}
          textAnchor="middle"
          className="fill-faint"
          style={{ fontSize: size * 0.052, fontWeight: 600, letterSpacing: 1.5 }}
        >
          ROUND 5 OF 8
        </text>
        <text
          x={centre}
          y={centre + 20}
          textAnchor="middle"
          fill="url(#lr-gold)"
          style={{ fontSize: size * 0.135, fontWeight: 800 }}
        >
          3,500 NIM
        </text>
        <text
          x={centre}
          y={centre + 42}
          textAnchor="middle"
          className="fill-muted"
          style={{ fontSize: size * 0.055 }}
        >
          4 of 7 paid in
        </text>

        {Array.from({ length: count }, (_, i) => {
          const angle = (i / count) * Math.PI * 2 - Math.PI / 2
          const x = centre + radius * Math.cos(angle)
          const y = centre + radius * Math.sin(angle)

          if (i === collector) {
            return (
              <g key={i}>
                <circle cx={x} cy={y} r={dot * 1.7} fill="#FFC24A" opacity="0.16" />
                <circle cx={x} cy={y} r={dot * 1.3} fill="none" stroke="#FFC24A" strokeWidth={dot * 0.14} />
                <circle cx={x} cy={y} r={dot} fill="url(#lr-gold)" />
              </g>
            )
          }

          const tones = ['#6E6482', '#5F6B7E', '#7C6A5E', '#5E7269', '#71627A', '#67707F', '#7A6E60']
          return (
            <g key={i}>
              <circle cx={x} cy={y} r={dot * 0.92} fill={tones[i % tones.length]} />
              {i <= paid && (
                <>
                  <circle cx={x + dot * 0.72} cy={y + dot * 0.72} r={dot * 0.44} fill="#4FD6A0" />
                  <path
                    d={`M${x + dot * 0.53} ${y + dot * 0.74} l${dot * 0.14} ${dot * 0.15} l${dot * 0.25} -${dot * 0.29}`}
                    fill="none"
                    stroke="#0C0A10"
                    strokeWidth={dot * 0.12}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </>
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}
