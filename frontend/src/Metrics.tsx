import './Metrics.css'

interface MetricsProps {
  wordsPerMinute: number;
  fillerCount: number;
  fillersPerMinute: number;
  longestPause: number;
  longestPauseTimeStamp: number;
  onSeek: (time: number) => void;
}

function Metrics({ wordsPerMinute, fillerCount, fillersPerMinute, longestPause, longestPauseTimeStamp, onSeek }: MetricsProps) {

    return (
        <div className="metrics">
            <h2>Metrics</h2>
            <ul>
                <li>Filler words: {fillerCount}</li>
                <li>Words per minute: {Math.round(wordsPerMinute)}</li>
                <li>Fillers per minute: {fillersPerMinute.toFixed(1)}</li>
                <li>
                    Longest pause:{' '}
                    <span className="pause-link"
                        onClick={() => onSeek(longestPauseTimeStamp)}
                        title="Jump to this moment in the video">
                        {longestPause.toFixed(1)}s
                    </span>
                </li>
            </ul>
        </div>
    )
}

export default Metrics