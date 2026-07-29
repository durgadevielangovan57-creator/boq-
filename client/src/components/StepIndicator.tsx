import { cn } from "@/lib/utils";
import { ChevronRight, CheckCircle2 } from "lucide-react";

interface Step {
  number: number;
  title: string;
  description?: string;
}

interface StepIndicatorProps {
  steps: Step[];
  currentStep: number;
  onStepClick?: (step: number) => void;
}

export function StepIndicator({ steps, currentStep, onStepClick }: StepIndicatorProps) {
  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-8">
        {steps.map((step, index) => (  
          <div key={step.number} className="flex items-center flex-1">  
            <button
              onClick={() => onStepClick?.(step.number)}
              className={cn(
                "flex flex-col items-center cursor-pointer transition-all",
                currentStep >= step.number ? "opacity-100" : "opacity-60"
              )}
            > 
              <div
                className={cn(
                  "h-12 w-12 rounded-full flex items-center justify-center font-bold text-sm transition-all",
                  currentStep > step.number
                    ? "bg-green-500 text-white"
                    : currentStep === step.number
                    ? "bg-blue-600 text-white scale-110 shadow-lg"
                    : "bg-muted text-muted-foreground border-2 border-border"
                )}           
              >                                                                                                         
                {currentStep > step.number ? (
                  <CheckCircle2 className="h-6 w-6" />
                ) : (
                  step.number
                )}
              </div>   
              <span className={cn(
                "text-xs font-semibold mt-2 text-center whitespace-nowrap",
                currentStep === step.number && "text-blue-600"
              )}>
                {step.title}
              </span>
              {step.description && (
                <span className="text-xs text-muted-foreground mt-1 text-center">
                  {step.description}
                </span>
              )}
            </button>

            {index < steps.length - 1 && (
              <div className="flex-1 h-1 mx-2 mb-6 bg-border rounded-full" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
