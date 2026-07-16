interface FeedbackProps {
    summary: string | null;
}

function Feedback({ summary }: FeedbackProps) {
    return (
        <div className="feedback">
            <h2>Feedback</h2>
            {summary ? <p>{summary}</p> : <p>No feedback available.</p>}
        </div>
    )
}

export default Feedback