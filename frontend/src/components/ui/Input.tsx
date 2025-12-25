import React, { forwardRef, InputHTMLAttributes } from 'react';
interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}
export const Input = forwardRef<HTMLInputElement, InputProps>(({
  className = '',
  label,
  error,
  ...props
}, ref) => {
  return <div className="w-full space-y-2">
        {label && <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-slate-700">
            {label}
          </label>}
        <input className={`flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200 ${error ? 'border-red-500 focus:ring-red-500' : ''} ${className}`} ref={ref} {...props} />
        {error && <p className="text-sm font-medium text-red-500">{error}</p>}
      </div>;
});
Input.displayName = 'Input';