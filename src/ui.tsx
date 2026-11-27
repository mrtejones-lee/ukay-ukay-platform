import { useEffect, useRef, type ReactNode, type ImgHTMLAttributes } from 'react'
import { ImageOff, X } from 'lucide-react'
import { initials, photo, type Navigate } from './model'

export function Link({ to, go, children, className, title, label }: { to: string; go: Navigate; children: ReactNode; className?: string; title?: string; label?: string }) {
  return <a href={to} title={title} aria-label={label} className={className} onClick={event => { if (event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) { event.preventDefault(); go(to) } }}>{children}</a>
}

export function Logo({ go }: { go: Navigate }) {
  return <Link to="/" go={go} className="logo"><img src="/mark.svg" alt="" width="37" height="37" /> <span>Ukay<span>Loop</span></span></Link>
}

export function Asset({ src = '', width = 640, ...props }: Omit<ImgHTMLAttributes<HTMLImageElement>, 'width'> & { width?: number }) {
  if (!src) return <div className="image-placeholder"><ImageOff size={26} /></div>
  return <img {...props} src={photo(src, width)} onError={event => { if (event.currentTarget.getAttribute('src') !== src) event.currentTarget.src = src }} />
}

export function Avatar({ src, name, size = 52 }: { src?: string; name: string; size?: number }) {
  return <span className="avatar" style={{ width: size, height: size }}>{src ? <Asset src={src} alt="" width={size * 2} loading="lazy" /> : initials(name)}</span>
}

export function Modal({ title, close, children, drawer = false }: { title: string; close: () => void; children: ReactNode; drawer?: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const node = dialog.current
    node?.showModal()
    const old = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { node?.close(); document.body.style.overflow = old }
  }, [])
  return <dialog ref={dialog} aria-label={title} className={drawer ? 'modal drawer' : 'modal'} onCancel={event => { event.preventDefault(); close() }} onClick={event => { if (event.target === dialog.current) { const bounds = dialog.current.getBoundingClientRect(); if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) close() } }}>
    <div className="modal-head"><h2>{title}</h2><button className="icon-btn" type="button" onClick={close} aria-label="Close"><X size={21} /></button></div>
    <div className="modal-content">{children}</div>
  </dialog>
}

export function Empty({ icon, title, body, action }: { icon?: ReactNode; title: string; body: string; action?: ReactNode }) {
  return <div className="empty-state"><span className="empty-icon">{icon || <ImageOff size={23} />}</span><h3>{title}</h3><p>{body}</p>{action}</div>
}

export function Pill({ children, tone = '' }: { children: ReactNode; tone?: string }) {
  return <span className={`pill ${tone}`}>{children}</span>
}

export const statusTone = (status: string) => ['Successful', 'Active', 'Free Trial', 'Visible'].includes(status) ? 'positive' : ['Failed', 'Expired', 'Hidden', 'Pending Deletion'].includes(status) ? 'negative' : ['Pending', 'Payment Due'].includes(status) ? 'warning' : ''
