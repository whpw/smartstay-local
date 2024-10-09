import { clsx } from 'clsx'
import { ComponentChildren } from 'preact'

export function Alert(
    { children, type = 'info' }: {
        type: 'info' | 'success' | 'error' | 'warning'
        children: ComponentChildren
    },
) {
    return (
        <div
            role='alert'
            className={clsx(
                'alert',
                type == 'error' && 'alert-error',
                type == 'info' && 'alert-info',
                type == 'success' && 'alert-success',
                type == 'warning' && 'alert-warning',
            )}
        >
            <svg
                xmlns='http://www.w3.org/2000/svg'
                className='h-6 w-6 shrink-0 stroke-current'
                fill='none'
                viewBox='0 0 24 24'
            >
                <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth='2'
                    d='M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z'
                />
            </svg>
            <span>{children}</span>
        </div>
    )
}
