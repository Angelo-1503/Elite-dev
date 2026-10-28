import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router-dom';
import Spinner from './Spinner';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const variants: Record<Variant, string> = {
	primary:
		'bg-brand-600 text-white hover:bg-brand-700 focus-visible:ring-brand-500 dark:bg-brand-500 dark:text-stone-950 dark:hover:bg-brand-400',
	secondary:
		'border border-stone-300 bg-white text-stone-800 hover:bg-stone-100 focus-visible:ring-stone-400 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100 dark:hover:bg-stone-800',
	ghost:
		'text-stone-700 hover:bg-stone-100 focus-visible:ring-stone-400 dark:text-stone-300 dark:hover:bg-stone-800',
	danger: 'bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500',
};

const sizes: Record<Size, string> = {
	sm: 'px-3 py-1.5 text-sm',
	md: 'px-4 py-2.5 text-sm',
	lg: 'px-5 py-3 text-base',
};

function buttonClass(variant: Variant, size: Size, fullWidth: boolean, className: string) {
	return `inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:opacity-50 dark:focus-visible:ring-offset-stone-950 ${variants[variant]} ${sizes[size]} ${fullWidth ? 'w-full' : ''} ${className}`;
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
	children: ReactNode;
	variant?: Variant;
	size?: Size;
	fullWidth?: boolean;
	loading?: boolean;
}

export default function Button({
	children,
	variant = 'primary',
	size = 'md',
	fullWidth = false,
	loading = false,
	className = '',
	disabled,
	type = 'button',
	...props
}: ButtonProps) {
	return (
		<button
			{...props}
			type={type}
			disabled={disabled || loading}
			className={buttonClass(variant, size, fullWidth, className)}
		>
			{loading && <Spinner className="size-4" />}
			{children}
		</button>
	);
}

interface ButtonLinkProps extends LinkProps {
	variant?: Variant;
	size?: Size;
	fullWidth?: boolean;
}

/** Link de navegação com aparência de botão (evita <button> dentro de <a>). */
export function ButtonLink({
	variant = 'primary',
	size = 'md',
	fullWidth = false,
	className = '',
	...props
}: ButtonLinkProps) {
	return <Link {...props} className={buttonClass(variant, size, fullWidth, className)} />;
}
