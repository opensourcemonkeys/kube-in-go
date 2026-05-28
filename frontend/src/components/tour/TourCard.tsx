import { CardComponentProps } from 'nextstepjs';

export default function TourCard({
    step,
    currentStep,
    totalSteps,
    nextStep,
    prevStep,
    skipTour,
    arrow,
}: CardComponentProps) {
    const progress = ((currentStep + 1) / totalSteps) * 100;
    const isLast = currentStep === totalSteps - 1;

    return (
        <div className="tour-card">
            <div className="tour-card__header">
                <div className="tour-card__title-row">
                    {step.icon && <span className="tour-card__icon">{step.icon}</span>}
                    <h3 className="tour-card__title">{step.title}</h3>
                </div>
            </div>

            <div className="tour-card__content">{step.content}</div>

            <div className="tour-card__progress-track">
                <div className="tour-card__progress-fill" style={{ width: `${progress}%` }} />
            </div>

            <div className="tour-card__footer">
                {step.showControls && (
                    <button
                        className="tour-card__btn tour-card__btn--secondary"
                        onClick={prevStep}
                        disabled={currentStep === 0}
                    >
                        Previous
                    </button>
                )}

                <span className="tour-card__counter">{currentStep + 1} / {totalSteps}</span>

                {step.showControls && (
                    <button
                        className={`tour-card__btn ${isLast ? 'tour-card__btn--finish' : 'tour-card__btn--primary'}`}
                        onClick={nextStep}
                    >
                        {isLast ? 'Finish' : 'Next'}
                    </button>
                )}
            </div>

            {skipTour && !isLast && step.showSkip && (
                <button className="tour-card__skip" onClick={skipTour}>
                    Skip Tour
                </button>
            )}

            {arrow}
        </div>
    );
}
