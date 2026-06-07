'use client'

interface Props {
  title: string
  sub?: string
  actions?: React.ReactNode
}

export default function Topbar({ title, sub, actions }: Props) {
  return (
    <div className="topbar">
      <div>
        <div className="topbar-title">{title}</div>
        {sub && <div className="topbar-sub">{sub}</div>}
      </div>
      <div className="topbar-spacer" />
      {actions}
    </div>
  )
}
