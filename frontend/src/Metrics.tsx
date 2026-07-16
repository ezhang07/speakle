import './Metrics.css'

interface MetricsProps {
  wordsPerMinute: number;
  fillerCount: number;
  fillersPerMinute: number;
  longestPause: number;
  longestPauseTimeStamp: number;
  bloatRatio: number | null;
  timeToFirstPoint: number | null;
  onSeek: (time: number) => void;
}

function Metrics({ wordsPerMinute, fillerCount, fillersPerMinute, longestPause, longestPauseTimeStamp, bloatRatio, timeToFirstPoint, onSeek }: MetricsProps) {

    return (
        <div className="metrics">
            <h2>Metrics</h2>
            <ul>
                <li>Filler words: {fillerCount}</li>
                <li>Words per minute: {Math.round(wordsPerMinute)}</li>
                <li>Fillers per minute: {fillersPerMinute.toFixed(1)}</li>
                <li>Bloat ratio: {bloatRatio !== null ? bloatRatio.toFixed(2) : 'N/A'}</li>
                <li>
                    Longest pause:{' '}
                    <span className="pause-link"
                        onClick={() => onSeek(longestPauseTimeStamp)}
                        title="Jump to this moment in the video">
                        {longestPause.toFixed(1)}s
                    </span>
                </li>
                <li>
                    Time to first point: {' '}
                    <span className="pause-link"
                        onClick={() => onSeek(timeToFirstPoint ?? 0)}
                        title="Jump to this moment in the video">
                        {timeToFirstPoint !== null ? timeToFirstPoint.toFixed(1) + 's' : 'N/A'}
                    </span>
                </li>
            </ul>
        </div>
    )
}

export default Metrics