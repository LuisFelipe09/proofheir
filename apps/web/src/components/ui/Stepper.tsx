import * as React from 'react';
import { Check } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface Step {
  id: string;
  title: string;
  description?: string;
}

export interface StepperProps {
  steps: Step[];
  currentStep: number;
  className?: string;
  onStepClick?: (index: number) => void;
}

export function Stepper({
  steps,
  currentStep,
  className,
  onStepClick,
}: StepperProps) {
  const progress = Math.min(
    100,
    Math.max(0, (currentStep / (steps.length - 1)) * 100),
  );

  return (
    <nav aria-label="Progress" className={cn('w-full', className)}>
      <ol className="flex justify-between items-center relative z-0">
        {/* Background Line */}
        <div
          className="absolute top-5 left-0 w-full h-0.5 bg-slate-700 -z-10"
          aria-hidden="true"
        />

        {/* Active Progress Line */}
        <div
          className="absolute top-5 left-0 h-0.5 bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-500 -z-10"
          style={{ width: `${progress}%` }}
          aria-hidden="true"
        />

        {steps.map((step, index) => {
          const isCompleted = index < currentStep;
          const isActive = index === currentStep;
          // Allow clicking if a handler is provided and it's a previous step or the current one (though clicking current does nothing usually)
          // We typically only allow navigating to visited steps
          const isClickable = !!onStepClick && index < currentStep;

          return (
            <li key={step.id} className="relative z-10">
              <button
                type="button"
                className={cn(
                  'relative flex flex-col items-center group focus:outline-none',
                  isClickable ? 'cursor-pointer' : 'cursor-default',
                )}
                onClick={() => isClickable && onStepClick(index)}
                // We don't use disabled={!isClickable} because that removes it from tab order entirely.
                // We want screen reader users to be able to inspect the steps even if they can't click them.
                aria-current={isActive ? 'step' : undefined}
                aria-disabled={!isClickable}
              >
                <div
                  className={cn(
                    'w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-300 ring-offset-2 ring-offset-slate-900',
                    isCompleted
                      ? 'bg-gradient-to-r from-emerald-500 to-green-500 text-white shadow-lg shadow-emerald-500/30'
                      : isActive
                        ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-lg shadow-cyan-500/30 ring-2 ring-cyan-500/50'
                        : 'bg-slate-700 text-slate-400 group-hover:bg-slate-600',
                    // Focus styles
                    'group-focus-visible:ring-2 group-focus-visible:ring-cyan-400',
                  )}
                >
                  {isCompleted ? (
                    <Check className="w-5 h-5" />
                  ) : (
                    <span>{index + 1}</span>
                  )}
                </div>

                {/* Label */}
                <span
                  className={cn(
                    'mt-2 text-xs font-medium transition-colors',
                    index <= currentStep ? 'text-white' : 'text-slate-500',
                  )}
                >
                  {step.title}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function StepContent({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'mt-4 animate-in fade-in slide-in-from-right-4 duration-300',
        className,
      )}
    >
      {children}
    </div>
  );
}
