import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { useAudioRecorder } from "@/hooks/use-audio-recorder";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Mic, MicOff, Square, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface VoiceInputButtonProps {
    onTranscription: (text: string) => void;
    disabled?: boolean;
    className?: string;
}

export function VoiceInputButton({
    onTranscription,
    disabled = false,
    className = "",
}: VoiceInputButtonProps) {
    const { isRecording, isPaused, duration, waveformData, audioBase64, audioBlob, isSupported, startRecording, stopRecording, resetRecording } = useAudioRecorder();
    const [isTranscribing, setIsTranscribing] = useState(false);
    const { toast } = useToast();

    const handleTranscribe = useCallback(async () => {
        if (!audioBase64 || !audioBlob) return;

        setIsTranscribing(true);
        try {
            const response = await apiRequest("POST", "/api/transcribe", {
                audioData: audioBase64,
                mimeType: audioBlob.type,
            });

            const data = await response.json();

            if (data.text) {
                onTranscription(data.text);
                toast({
                    title: "Transcription complete",
                    description: "Your voice has been converted to text.",
                });
            }
        } catch (error: any) {
            toast({
                title: "Transcription failed",
                description: error.message || "Failed to transcribe audio. Please try again.",
                variant: "destructive",
            });
        } finally {
            setIsTranscribing(false);
            resetRecording();
        }
    }, [audioBase64, audioBlob, onTranscription, resetRecording, toast]);

    const handleMicClick = useCallback(async () => {
        if (isRecording) {
            stopRecording();
            // Transcription will be triggered after recording stops
        } else {
            try {
                await startRecording();
            } catch (error: any) {
                toast({
                    title: "Microphone access denied",
                    description: "Please allow microphone access to use voice input.",
                    variant: "destructive",
                });
            }
        }
    }, [isRecording, startRecording, stopRecording, toast]);

    // Auto-transcribe when recording stops
    const handleStopAndTranscribe = useCallback(() => {
        if (isRecording) {
            stopRecording();
        }
    }, [isRecording, stopRecording]);

    // Trigger transcription when we have audio data
    const shouldTranscribe = audioBase64 && !isRecording && !isTranscribing;
    if (shouldTranscribe) {
        // Use setTimeout to prevent state updates during render
        setTimeout(() => handleTranscribe(), 0);
    }

    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, "0")}`;
    };

    if (!isSupported) {
        return null;
    }

    return (
        <div className={`inline-flex items-center gap-2 ${className}`}>
            <AnimatePresence mode="wait">
                {isRecording ? (
                    <motion.div
                        key="recording"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className="flex items-center gap-3"
                    >
                        {/* Waveform visualization */}
                        <div className="flex items-center gap-0.5 h-8 px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-lg">
                            {waveformData.map((value, index) => (
                                <motion.div
                                    key={index}
                                    className="w-1 bg-red-500 rounded-full"
                                    initial={{ height: 4 }}
                                    animate={{ height: Math.max(4, value * 28) }}
                                    transition={{ duration: 0.05 }}
                                />
                            ))}
                        </div>

                        {/* Duration */}
                        <span className="text-sm font-mono text-red-500">
                            {formatDuration(duration)}
                        </span>

                        {/* Stop button */}
                        <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            onClick={handleStopAndTranscribe}
                            className="gap-1"
                        >
                            <Square className="w-3 h-3" />
                            Stop
                        </Button>
                    </motion.div>
                ) : isTranscribing ? (
                    <motion.div
                        key="transcribing"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className="flex items-center gap-2"
                    >
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled
                            className="gap-2"
                        >
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Transcribing...
                        </Button>
                    </motion.div>
                ) : (
                    <motion.div
                        key="idle"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                    >
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handleMicClick}
                            disabled={disabled}
                            className="gap-2"
                        >
                            <Mic className="w-4 h-4" />
                            Voice
                        </Button>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
