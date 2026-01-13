import * as React from 'react'
import { Check } from 'lucide-react'
import { cn } from '../../lib/utils'

export interface Step {
    id: string
    title: string
    description?: string
}

export interface StepperProps {
    steps: Step[]
    currentStep: number
    className?: string
    onStepClick?: (index: number) => void
}

export function Stepper({ steps, currentStep, className, onStepClick }: StepperProps) {
    return (
        <nav aria-label="Progress" className={cn("w-full", className)}>
            <div className="relative mb-8">
                {/* Connecting Line */}
                <div
                    className="absolute top-1/2 left-0 w-full h-0.5 bg-gray-200 z-0 -translate-y-1/2"
                    aria-hidden="true"
                />

                <ol className="flex justify-between items-center relative z-10">
                    {steps.map((step, index) => {
                        const isCompleted = index < currentStep
                        const isActive = index === currentStep
                        const isClickable = !!(onStepClick && index <= currentStep)

                        return (
                            <li key={step.id}>
                                <button
                                    type="button"
                                    onClick={() => isClickable && onStepClick && onStepClick(index)}
                                    disabled={!isClickable}
                                    aria-current={isActive ? 'step' : undefined}
                                    className={cn(
                                        "relative flex items-center justify-center bg-white p-1 transition-colors",
                                        "appearance-none border-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 rounded-full",
                                        isClickable ? "cursor-pointer" : "cursor-default"
                                    )}
                                >
                                    <div
                                        className={cn(
                                            "w-8 h-8 rounded-full border-2 flex items-center justify-center font-bold text-xs transition-all duration-200",
                                            isActive || isCompleted
                                                ? "bg-blue-600 border-blue-600 text-white"
                                                : "bg-white border-gray-300 text-gray-500"
                                        )}
                                    >
                                        {isCompleted ? (
                                            <Check className="w-4 h-4" aria-hidden="true" />
                                        ) : (
                                            <span>{index + 1}</span>
                                        )}
                                    </div>

                                    {/* Label */}
                                    <span className="absolute top-10 whitespace-nowrap text-xs font-medium text-center left-1/2 -translate-x-1/2">
                                        <span className={cn(
                                            isActive ? "text-blue-600" : isCompleted ? "text-gray-900" : "text-gray-400"
                                        )}>
                                            {step.title}
                                        </span>
                                    </span>
                                </button>
                            </li>
                        )
                    })}
                </ol>
            </div>
        </nav>
    )
}

export function StepContent({ children, className }: { children: React.ReactNode, className?: string }) {
    return (
        <div className={cn("mt-4 animate-in fade-in slide-in-from-right-4 duration-300", className)}>
            {children}
        </div>
    )
}
