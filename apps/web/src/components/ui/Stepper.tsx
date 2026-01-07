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
        <div className={cn("w-full", className)}>
            <div className="flex justify-between items-center mb-8 relative">
                {/* Connecting Line */}
                <div className="absolute top-1/2 left-0 w-full h-0.5 bg-gray-200 -z-0 -translate-y-1/2" />

                {steps.map((step, index) => {
                    const isCompleted = index < currentStep
                    const isActive = index === currentStep

                    return (
                        <div
                            key={step.id}
                            className={cn("relative flex items-center justify-center bg-white z-10 p-1 cursor-pointer transition-colors")}
                            onClick={() => onStepClick && index <= currentStep && onStepClick(index)}
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
                                    <Check className="w-4 h-4" />
                                ) : (
                                    <span>{index + 1}</span>
                                )}
                            </div>

                            {/* Label */}
                            <div className="absolute top-10 whitespace-nowrap text-xs font-medium text-center">
                                <span className={cn(
                                    isActive ? "text-blue-600" : isCompleted ? "text-gray-900" : "text-gray-400"
                                )}>
                                    {step.title}
                                </span>
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

export function StepContent({ children, className }: { children: React.ReactNode, className?: string }) {
    return (
        <div className={cn("mt-4 animate-in fade-in slide-in-from-right-4 duration-300", className)}>
            {children}
        </div>
    )
}
