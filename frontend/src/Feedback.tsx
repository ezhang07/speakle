import './Feedback.css'

interface FeedbackProps {
    summary: string | null;
}

/** The AI note. Deliberately set apart from the metrics grid and never given a
 *  number — it should read as something a person said, not another score. */
function Feedback({ summary }: FeedbackProps) {
    return (
        <section className="feedback">
            <span className="feedback-quote" aria-hidden="true">&ldquo;</span>
            <div className="feedback-inner">
                <div className="feedback-head">
                    <h2>Notes</h2>
                </div>
                {summary
                    ? <p className="feedback-body">{summary}</p>
                    : <p className="feedback-body muted">
                        No note for this session &mdash; the transcript and metrics are still all here.
                      </p>}
            </div>
        </section>
    )
}

export default Feedback
