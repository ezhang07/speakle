import { useEffect, useRef } from 'react'
import './ConfirmDialog.css'

interface ConfirmDialogProps {
    open: boolean
    title: string
    body?: string
    confirmLabel: string
    /** Styles the confirm button as destructive. Use for anything that loses data. */
    destructive?: boolean
    onConfirm: () => void
    onCancel: () => void
}

/**
 * A small modal for "are you sure?" moments.
 *
 * Built on the native <dialog> so Esc-to-dismiss, the backdrop, and focus
 * trapping come from the platform instead of being hand-rolled. Cancel is
 * first in the DOM on purpose: <dialog> focuses the first focusable child, so
 * the safe choice is the one under the user's finger.
 */
function ConfirmDialog({
    open,
    title,
    body,
    confirmLabel,
    destructive,
    onConfirm,
    onCancel,
}: ConfirmDialogProps) {
    const ref = useRef<HTMLDialogElement>(null)

    useEffect(() => {
        const el = ref.current
        if (!el) return
        if (open && !el.open) el.showModal()
        if (!open && el.open) el.close()
    }, [open])

    return (
        <dialog
            ref={ref}
            className="confirm"
            // Esc closes the dialog itself, so mirror that back into React state.
            onClose={onCancel}
            // A click on the backdrop targets the <dialog> element; clicks on the
            // content target .confirm-inner, so this only fires outside the card.
            onClick={(e) => { if (e.target === ref.current) onCancel() }}
        >
            <div className="confirm-inner">
                <h2 className="confirm-title">{title}</h2>
                {body && <p className="confirm-body">{body}</p>}

                <div className="confirm-actions">
                    <button type="button" className="btn btn-sm" onClick={onCancel}>
                        Cancel
                    </button>
                    <button
                        type="button"
                        className={destructive ? 'btn btn-danger btn-sm' : 'btn btn-primary btn-sm'}
                        onClick={onConfirm}
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </dialog>
    )
}

export default ConfirmDialog
