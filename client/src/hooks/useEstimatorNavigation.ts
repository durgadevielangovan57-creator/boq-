import { useState } from "react";

export function useEstimatorNavigation(initial = 1) {
  const [step, setStep] = useState<number>(initial);
  const next = () => setStep((s) => s + 1);
  const back = () => setStep((s) => Math.max(1, s - 1));
  const reset = () => setStep(initial);
  return { step, setStep, next, back, reset };
}

export default useEstimatorNavigation;
