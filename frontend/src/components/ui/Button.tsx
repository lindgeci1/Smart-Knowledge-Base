import React, { ButtonHTMLAttributes } from 'react';
import { Loader2 } from 'lucide-react';
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  isLoading?: boolean;
}
export function Button({
  children,
  className = '',
  variant = 'primary',
  isLoading = false,
  disabled,
  ...props
}: ButtonProps) {
  const baseStyles = 'inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-white';
  const variants = {
    primary: 'bg-indigo-600 text-white hover:bg-indigo-700 focus-visible:ring-indigo-600 shadow-sm',
    secondary: 'bg-slate-100 text-slate-900 hover:bg-slate-200 focus-visible:ring-slate-500',
    outline: 'border border-slate-200 hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-slate-500',
    ghost: 'hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-slate-500'
  };
  const sizes = 'h-10 py-2 px-4';
  return <button className={`${baseStyles} ${variants[variant]} ${sizes} ${className}`} disabled={disabled || isLoading} {...props}>
      {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      {children}
    </button>;
}