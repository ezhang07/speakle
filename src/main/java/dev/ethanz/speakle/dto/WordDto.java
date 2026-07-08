package dev.ethanz.speakle.dto;


// dto are used to parse json strings into a certain shape (shape of a dto) in the backend. so backend knows exactly what to convert json string into.
public class WordDto {

    private String word;
    private double start;
    private double end;

    public String getWord() {
        return word;
    }

    public double getStart() {
        return start;
    }

    public double getEnd() {
        return end;
    }

    public void setWord(String word) {
        this.word = word;
    }

    public void setStart(double start) {
        this.start = start;
    }

    public void setEnd(double end) {
        this.end = end;
    }


}