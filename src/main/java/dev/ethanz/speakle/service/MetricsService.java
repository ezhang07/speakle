package dev.ethanz.speakle.service;

import java.util.List;
import java.util.Set;

import org.springframework.stereotype.Service;

import dev.ethanz.speakle.dto.WordDto;
import dev.ethanz.speakle.model.Metrics;

@Service
public class MetricsService {

    private static final Set<String> FILLERS = Set.of("um", "uh", "like");

    // calculate metrics based on a recording's transcript, timestamp on words
    public Metrics compute(List<WordDto> words) {
        if (words == null || words.isEmpty()) {
            return new Metrics(0, 0, 0, 0, 0, 0, null, null);
        }

        double durationSeconds = words.get(words.size() - 1).getEnd() - words.get(0).getStart();

        double durationMinutes = durationSeconds / 60;

        double wordsPerMinute = words.size() / durationMinutes;

        int fillerCount = 0;
        for (WordDto w: words) {
            if (FILLERS.contains(w.getWord().toLowerCase().replaceAll("[^a-z]", ""))) {
                fillerCount++;
            }
        }

        double fillersPerMinute = fillerCount / durationMinutes;

        double longestPause = words.get(0).getStart(); // gap btw rec start and first word
        double longestPauseTimeStamp = 0.0;

        for (int i = 0; i < words.size() - 1; i++) {
            double gap = words.get(i+1).getStart() - words.get(i).getEnd();
            
            if (gap > longestPause) {
                longestPause = gap;
                longestPauseTimeStamp = words.get(i).getEnd();
            }
        }
        

        return new Metrics(durationSeconds, wordsPerMinute, fillerCount, fillersPerMinute, longestPause, longestPauseTimeStamp, null, null);
    }
}