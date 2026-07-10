import type { Word } from './types'

interface TranscriptProps {
    words: Word[];
    onSeek: (time: number) => void;
}

function Transcript({ words, onSeek }: TranscriptProps) {
    const fillerWords = new Set(['um', 'uh', 'like'])

    function isFiller(word: string) {
        return fillerWords.has(word.toLowerCase().replace(/[^a-z]/g, ''));
    }


    return (
        <div>
            <h2>Transcript</h2>
            <p>{words.map((w, i) => (
                <span key={i} className={isFiller(w.word) ? 'filler word' : 'word'}
                onClick={() => onSeek(w.start)}>
                    {w.word}{''}
                </span>
            ))}</p>

        </div>
    )
}

export default Transcript
