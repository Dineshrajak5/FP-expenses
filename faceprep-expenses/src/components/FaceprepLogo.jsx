import { useTheme } from '../hooks/useTheme'

export default function FacerepLogo({ width = 180, style = {} }) {
  const { theme } = useTheme()
  return (
    <img
      src={theme === 'dark' ? '/faceprep-logo-dark.svg' : '/faceprep-logo.svg'}
      alt="FACE Prep"
      style={{ width, height: 'auto', display: 'block', ...style }}
    />
  )
}
