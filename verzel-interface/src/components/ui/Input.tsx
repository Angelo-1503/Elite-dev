import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react';
import { useId } from 'react';

export const inputClass =
	'w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-stone-900 placeholder:text-stone-400 transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 disabled:opacity-60 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100 dark:placeholder:text-stone-500';

interface FieldProps {
	label: string;
	hint?: ReactNode;
	error?: string;
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement>, FieldProps {
	prefix?: string;
}

export default function Input({
	label,
	hint,
	error,
	prefix,
	id,
	className = '',
	...rest
}: InputProps) {
	const generatedId = useId();
	const inputId = id ?? generatedId;

	return (
		<div className="flex flex-col gap-1.5">
			<label htmlFor={inputId} className="text-sm font-medium text-stone-700 dark:text-stone-300">
				{label}
			</label>
			<div className="relative">
				{prefix && (
					<span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-stone-500">
						{prefix}
					</span>
				)}
				<input
					{...rest}
					id={inputId}
					aria-invalid={!!error}
					className={`${inputClass} ${prefix ? 'pl-10' : ''} ${error ? 'border-red-500' : ''} ${className}`}
				/>
			</div>
			{error ? (
				<p className="text-sm text-red-600 dark:text-red-400">{error}</p>
			) : (
				hint && <p className="text-xs text-stone-500 dark:text-stone-400">{hint}</p>
			)}
		</div>
	);
}

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement>, FieldProps {}

export function Textarea({ label, hint, error, id, ...rest }: TextareaProps) {
	const generatedId = useId();
	const inputId = id ?? generatedId;

	return (
		<div className="flex flex-col gap-1.5">
			<label htmlFor={inputId} className="text-sm font-medium text-stone-700 dark:text-stone-300">
				{label}
			</label>
			<textarea {...rest} id={inputId} className={`${inputClass} min-h-24 resize-y`} />
			{error ? (
				<p className="text-sm text-red-600">{error}</p>
			) : (
				hint && <p className="text-xs text-stone-500 dark:text-stone-400">{hint}</p>
			)}
		</div>
	);
}
