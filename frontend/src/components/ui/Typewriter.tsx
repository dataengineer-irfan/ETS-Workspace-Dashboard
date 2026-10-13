import React, { useState, useEffect } from 'react';

interface TypewriterProps {
  text: string[];
  speed?: number;
  deleteSpeed?: number;
  delay?: number;
  loop?: boolean;
}

export const Typewriter: React.FC<TypewriterProps> = ({
  text,
  speed = 50,
  deleteSpeed = 30,
  delay = 2000,
  loop = true,
}) => {
  const [currentSentenceIndex, setCurrentSentenceIndex] = useState<number>(0);
  const [currentText, setCurrentText] = useState<string>('');
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  useEffect(() => {
    if (!text || text.length === 0) return;

    const fullSentence = text[currentSentenceIndex % text.length];

    let timer: ReturnType<typeof setTimeout>;

    if (!isDeleting && currentText === fullSentence) {
      // Pause at full sentence before deleting
      timer = setTimeout(() => {
        setIsDeleting(true);
      }, delay);
    } else if (isDeleting && currentText === '') {
      // Move to next sentence
      setIsDeleting(false);
      setCurrentSentenceIndex((prev) => (prev + 1) % text.length);
    } else {
      // Type or delete characters
      const typingSpeed = isDeleting ? deleteSpeed : speed;
      timer = setTimeout(() => {
        setCurrentText((prev) =>
          isDeleting
            ? fullSentence.substring(0, prev.length - 1)
            : fullSentence.substring(0, prev.length + 1)
        );
      }, typingSpeed);
    }

    return () => clearTimeout(timer);
  }, [currentText, isDeleting, currentSentenceIndex, text, speed, deleteSpeed, delay, loop]);

  return (
    <span className="inline-flex items-baseline">
      <span>{currentText}</span>
      <span className="ml-0.5 inline-block w-1.5 h-3.5 bg-cyan-400 dark:bg-cyan-300 animate-pulse align-middle" />
    </span>
  );
};

export default Typewriter;
