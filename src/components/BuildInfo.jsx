export default function BuildInfo() {
  const hash = typeof __BUILD_HASH__ !== 'undefined' ? __BUILD_HASH__ : 'dev'
  const time = typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : null
  const display = time
    ? new Date(time).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : ''

  return (
    <p className="text-white/30 text-xs mt-1 tracking-wide">
      Built by Mike Dulin · {hash}{display ? ` · ${display}` : ''}
    </p>
  )
}
