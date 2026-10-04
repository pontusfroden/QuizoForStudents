import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Eye,
  Flag,
  RotateCcw,
  Sparkles,
  X,
} from 'lucide-react';
import { keywords, optionsFor, shuffle, studyQueue } from '../lib/study';
import type { Mode, StudyCard, StudyDeck } from '../types';
import { t, locationLabel } from '../lib/i18n';

interface Props {
  deck: StudyDeck;
  mode: Mode;
  weakOnly: boolean;
  onClose: () => void;
  onReview: (cardId: string, correct: boolean) => void;
  onFinish: (mode: string, correct: number, total: number) => void;
  onRequestAnswer: (cardId: string) => void;
  answersPreparing?: boolean;
}
export default function StudySession(props: Props) {
  const [round, setRound] = useState(0);
  const [questionCount, setQuestionCount] = useState(10);
  const [started, setStarted] = useState(false);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [written, setWritten] = useState('');
  const [score, setScore] = useState(0);
  const [complete, setComplete] = useState(false);
  const [sourceOpen, setSourceOpen] = useState(false);
  const [imageHidden, setImageHidden] = useState(false);
  const [matched, setMatched] = useState<string[]>([]);
  const [selectedTerm, setSelectedTerm] = useState<string | null>(null);
  const [selectedDefinition, setSelectedDefinition] = useState<string | null>(null);
  const [mismatch, setMismatch] = useState(false);
  const [matchMistakes, setMatchMistakes] = useState<Set<string>>(new Set());
  const finalised = useRef(false);
  const skippedInRound = useRef(0);
  const initialDeck = useRef(props.deck);
  if (!started) initialDeck.current = props.deck;
  const deck = initialDeck.current;
  const queue = useMemo(() => studyQueue(deck, props.weakOnly), [deck, props.weakOnly, round]);
  const matchCards = useMemo(() => {
    const seen = new Set<string>();
    return queue
      .filter((card) => {
        const term = card.term.toLocaleLowerCase();
        if (seen.has(term)) return false;
        seen.add(term);
        return true;
      })
      .slice(0, 5);
  }, [queue]);
  const matchDefinitions = useMemo(() => shuffle(matchCards), [matchCards]);
  const sessionCards = queue
    .slice(0, questionCount)
    .map((card) => props.deck.cards.find((current) => current.id === card.id) ?? card);
  const exams = (
    deck.examPrompts.length
      ? deck.examPrompts
          .filter((item) => item.answerType !== 'unavailable')
          .map((item) => props.deck.examPrompts.find((current) => current.id === item.id) ?? item)
      : queue.map((card) => ({
          id: card.id,
          prompt:
            card.kind === 'image'
              ? t('Study the image, hide it, and recall its main points.')
              : card.prompt,
          sourceId: card.sourceId,
          location: card.location,
          choices: card.choices,
          answer: card.kind ? card.answer : card.evidence,
          answerExplanation: card.answerExplanation,
          relatedCardIds: card.kind === 'image' ? [] : [card.id],
        }))
  ).slice(0, questionCount);
  const total =
    props.mode === 'match'
      ? matchCards.length
      : props.mode === 'exam'
        ? exams.length
        : sessionCards.length;
  const card = sessionCards[index];
  const exam = exams[index];
  const examCard = props.deck.cards.find(
    (item) => item.sourceId === exam?.sourceId && item.prompt === exam?.prompt,
  );
  const options = useMemo(() => (card ? optionsFor(card, deck.cards) : []), [card, deck.cards]);
  const manualQuiz =
    props.mode === 'quiz' &&
    !!card?.kind &&
    (card.answerStatus === 'missing' ||
      card.answerType === 'approach' ||
      card.answerType === 'unavailable' ||
      options.length < 2);
  const unavailable =
    (props.mode === 'exam' ? examCard?.answerType : card?.answerType) === 'unavailable';
  const skippedCount = props.deck.cards.filter((item) => item.answerType === 'unavailable').length;
  const visualItem =
    props.mode === 'exam'
      ? !deck.examPrompts.length
        ? exams[index]
        : undefined
      : card?.kind === 'image'
        ? card
        : undefined;
  const visualBlock = visualItem
    ? deck.sources
        .find((source) => source.id === visualItem.sourceId)
        ?.blocks.find((block) => block.label === visualItem.location && block.image)
    : undefined;
  const name = {
    quiz: t('Quick quiz'),
    flashcards: t('Flashcards'),
    match: t('Match it'),
    recall: t('Written recall'),
    exam: t('Past paper practice'),
  }[props.mode];
  const finish = (finalScore: number) => {
    if (!finalised.current) {
      props.onFinish(name, finalScore, total - skippedInRound.current);
      finalised.current = true;
    }
    setComplete(true);
  };
  function next(correct: boolean, review = true) {
    if (review && card) props.onReview(card.id, correct);
    const nextScore = score + Number(correct);
    setScore(nextScore);
    if (index + 1 >= total) finish(nextScore);
    else {
      setIndex(index + 1);
      setSelected(null);
      setRevealed(false);
      setWritten('');
      setSourceOpen(false);
      setImageHidden(false);
    }
  }
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (
        (event.target as HTMLElement).matches('input,textarea,select,button') ||
        !started ||
        complete ||
        props.mode !== 'flashcards'
      )
        return;
      if (event.code === 'Space') {
        event.preventDefault();
        setRevealed((value) => !value);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [started, complete, props.mode]);
  function reset() {
    setRound((value) => value + 1);
    setIndex(0);
    setRevealed(false);
    setSelected(null);
    setWritten('');
    setScore(0);
    setComplete(false);
    setStarted(false);
    setMatched([]);
    setMatchMistakes(new Set());
    setSelectedTerm(null);
    setSelectedDefinition(null);
    finalised.current = false;
    skippedInRound.current = 0;
  }
  function tryMatch(termId: string | null, definitionId: string | null) {
    if (!termId || !definitionId) return;
    if (termId === definitionId) {
      const correct = !matchMistakes.has(termId);
      const skipped =
        props.deck.cards.find((item) => item.id === termId)?.answerType === 'unavailable';
      if (skipped) skippedInRound.current++;
      else props.onReview(termId, correct);
      const nextScore = score + Number(!skipped && correct);
      setScore(nextScore);
      const nextMatched = [...matched, termId];
      setMatched(nextMatched);
      setSelectedTerm(null);
      setSelectedDefinition(null);
      setMismatch(false);
      if (nextMatched.length === matchCards.length) finish(nextScore);
    } else {
      setMismatch(true);
      setMatchMistakes((current) => new Set([...current, termId, definitionId]));
    }
  }
  const related =
    exam?.relatedCardIds
      .map((id) => deck.cards.find((card) => card.id === id))
      .filter((card): card is StudyCard => !!card) ?? [];
  return (
    <div className="session-shell">
      <div className="session-heading">
        <button className="text-button" onClick={props.onClose}>
          <ArrowLeft size={17} /> {t('Back to your study set')}{' '}
        </button>
        <span className="session-mode">
          <Sparkles size={15} />
          {name}
        </span>
      </div>
      {!started ? (
        <div className="session-intro">
          <span className="large-mode-icon">
            <Sparkles size={30} />
          </span>
          <span className="eyebrow">{t('A LITTLE PRACTICE GOES A LONG WAY')}</span>
          <h1>
            {name === t('Match it') ? t('Make the connections.') : t('Let’s see what sticks.')}
          </h1>
          <p>
            {props.weakOnly
              ? t('A focused round with concepts that need another look.')
              : props.mode === 'exam'
                ? t(
                    'Practice questions from your material. Attempt an answer, reveal source support, and rate your recall.',
                  )
                : props.mode === 'match'
                  ? t('Match questions, concepts, or images to their source excerpts.')
                  : props.mode === 'recall'
                    ? t(
                        'Explain a concept in your own words, then compare it with the original notes.',
                      )
                    : t(
                        'Practice questions and source facts work in every study mode. No separate notes are required.',
                      )}
          </p>
          {props.mode !== 'match' && (
            <label className="session-length">
              {t('Session length')}{' '}
              <select
                value={questionCount}
                onChange={(event) => setQuestionCount(Number(event.target.value))}
              >
                <option value={5}>{t('5 questions · a quick warm-up')}</option>
                <option value={10}>{t('10 questions · a focused session')}</option>
                <option value={20}>{t('20 questions · a deeper dive')}</option>
                <option value={50}>{t('50 questions · the full stretch')}</option>
              </select>
            </label>
          )}
          <button
            className="button primary"
            disabled={total === 0}
            onClick={() => setStarted(true)}
          >
            {t('Start')} {total} {props.mode === 'match' ? t('pairs') : t('questions')}
            <ArrowRight size={16} />
          </button>
          {total === 0 && (
            <p className="warning-text">
              {skippedCount
                ? t(
                    'No answerable questions are available yet. Add the missing source material to reassess skipped questions.',
                  )
                : props.mode === 'exam'
                  ? t('Upload a past test and mark its file type as “Past test” to use this mode.')
                  : props.weakOnly
                    ? t('No weak concepts yet. Finish a quiz to find your focus areas.')
                    : t(
                        'No readable study content was found. Try another file or use an image for visual practice.',
                      )}
            </p>
          )}
          {skippedCount > 0 && (
            <p className="warning-text">
              {skippedCount === 1
                ? t('1 question without a usable answer is excluded from practice.')
                : t('{count} questions without usable answers are excluded from practice.', {
                    count: skippedCount,
                  })}
            </p>
          )}
          <small>{t('Your progress is saved after each answer.')}</small>
        </div>
      ) : complete ? (
        <div className="session-intro completion">
          <span className="large-mode-icon">
            <CheckCircle2 size={34} />
          </span>
          <span className="eyebrow">{t('ONE STEP CLOSER')}</span>
          <h1>
            {score === total - skippedInRound.current
              ? t('Look at you go.')
              : t('That’s how learning happens.')}
          </h1>
          <p>
            {score} {t('of')} {total - skippedInRound.current}{' '}
            {t('correct or self-rated confident')}.{' '}
            {score === total - skippedInRound.current
              ? t('Revisit these later to help them stick.')
              : t('The tricky concepts are waiting in your review queue.')}
          </p>
          <div className="completion-score">
            {total > skippedInRound.current
              ? Math.round((score / (total - skippedInRound.current)) * 100)
              : '—'}
            <span>%</span>
          </div>
          <div className="button-row">
            <button className="button secondary" onClick={reset}>
              <RotateCcw size={16} /> {t('Another round')}{' '}
            </button>
            <button className="button primary" onClick={props.onClose}>
              {t('Back to overview')} <ArrowRight size={16} />
            </button>
          </div>
        </div>
      ) : props.mode === 'match' ? (
        <>
          <div className="session-top">
            <h1>{t('Find their other half.')}</h1>
            <span>
              {matched.length} / {total} {t('pairs')}{' '}
            </span>
          </div>
          <p className="muted">
            {t(
              'Choose a concept and its definition. A mismatch means both concepts go into your review queue.',
            )}{' '}
          </p>
          <div className="match-grid">
            <div>
              {matchCards.map((card) => (
                <button
                  key={card.id}
                  className={`match-tile term ${matched.includes(card.id) ? 'matched' : ''} ${selectedTerm === card.id ? 'selected' : ''}`}
                  disabled={matched.includes(card.id)}
                  onClick={() => {
                    setMismatch(false);
                    setSelectedTerm(card.id);
                    tryMatch(card.id, selectedDefinition);
                  }}
                >
                  {card.term}
                  {matched.includes(card.id) && <Check size={18} />}
                </button>
              ))}
            </div>
            <div>
              {matchDefinitions.map((card) => (
                <button
                  key={card.id}
                  className={`match-tile definition ${matched.includes(card.id) ? 'matched' : ''} ${selectedDefinition === card.id ? 'selected' : ''}`}
                  disabled={matched.includes(card.id)}
                  onClick={() => {
                    setMismatch(false);
                    setSelectedDefinition(card.id);
                    tryMatch(selectedTerm, card.id);
                  }}
                >
                  {card.kind === 'image' ? (
                    <img
                      className="match-image"
                      src={
                        deck.sources
                          .find((source) => source.id === card.sourceId)
                          ?.blocks.find((block) => block.label === card.location)?.image
                      }
                      alt={t('Source image')}
                    />
                  ) : (
                    (card.matchText ?? card.prompt.replace(/______/g, '[…]'))
                  )}
                  {matched.includes(card.id) && <Check size={18} />}
                </button>
              ))}
            </div>
          </div>
          {mismatch && (
            <p role="status" className="match-feedback">
              {t('Almost. Try a different connection.')}{' '}
            </p>
          )}
        </>
      ) : (
        <>
          <div className="session-top">
            <h1>{name}</h1>
            <span>
              {index + 1} / {total}
            </span>
          </div>
          <div className="progress-track">
            <span style={{ width: `${(index / total) * 100}%` }} />
          </div>
          <div className={`question-panel ${props.mode === 'flashcards' ? 'flashcard-panel' : ''}`}>
            <span className="eyebrow">
              {props.mode === 'exam'
                ? t('YOUR PAST PAPER')
                : props.mode === 'quiz'
                  ? t('COMPLETE THE IDEA')
                  : t('RECALL BEFORE YOU REVEAL')}
            </span>
            <h2>
              {props.mode === 'exam'
                ? exam.prompt
                : props.mode === 'quiz'
                  ? card.kind === 'image'
                    ? t('Study the image, hide it, and recall its main points.')
                    : card.prompt
                  : card.kind === 'image'
                    ? t('Study the image, hide it, and recall its main points.')
                    : card.kind === 'question'
                      ? card.prompt
                      : t('What do you remember about {term}?', { term: card.term })}
            </h2>
            {card?.answerStatus === 'missing' && props.mode !== 'exam' && (
              <p className="answer-label">
                {card.kind === 'image'
                  ? t('Visual recall · compare with the source image')
                  : t('Practice question · no verified answer in the source')}
              </p>
            )}
            {(props.mode === 'exam' ? examCard?.answerStatus : card?.answerStatus) === 'ai' && (
              <p className="answer-label">
                {unavailable
                  ? t('Skipped · source information is missing')
                  : (props.mode === 'exam' ? examCard?.answerType : card?.answerType) === 'approach'
                    ? t('Solution approach · exact answer needs more information')
                    : t('AI suggestion · review against your course material')}
              </p>
            )}
            {visualBlock?.image && !revealed && (
              <div className="visual-recall">
                {!imageHidden && (
                  <img className="source-image" src={visualBlock.image} alt={t('Source image')} />
                )}
                <button
                  className="button secondary"
                  onClick={() => setImageHidden((value) => !value)}
                >
                  {imageHidden ? t('Show image') : t('Hide image and recall')}
                </button>
              </div>
            )}
            {(props.mode === 'exam'
              ? exam.choices
              : props.mode !== 'quiz' && props.mode !== 'flashcards'
                ? card?.choices
                : undefined
            )?.length ? (
              <ol className="question-choices" type="a">
                {(props.mode === 'exam' ? exam.choices : card.choices)!.map((choice) => (
                  <li key={choice}>{choice}</li>
                ))}
              </ol>
            ) : null}
            {props.mode === 'quiz' && (
              <div className="quiz-options">
                {options.length >= 2 ? (
                  options.map((option, i) => (
                    <button
                      className={`quiz-option ${!manualQuiz && selected !== null && option === card.answer ? 'correct' : ''} ${selected === option ? (manualQuiz ? 'selected' : option !== card.answer ? 'incorrect' : '') : ''}`}
                      disabled={selected !== null}
                      key={option}
                      onClick={() => {
                        setSelected(option);
                        if (manualQuiz) setRevealed(true);
                        else props.onReview(card.id, option === card.answer);
                      }}
                    >
                      <span>{String.fromCharCode(65 + i)}</span>
                      {option}
                      {!manualQuiz && selected !== null && option === card.answer && (
                        <Check size={18} />
                      )}
                    </button>
                  ))
                ) : (
                  <>
                    <p className="muted">
                      {manualQuiz
                        ? t('Try answering in your own words, then reveal the source support.')
                        : t('This set has one answer concept. Try recalling it yourself.')}{' '}
                    </p>
                    <input
                      value={written}
                      aria-label={t('Your quiz answer')}
                      onChange={(event) => setWritten(event.target.value)}
                      disabled={selected !== null}
                    />
                    <button
                      className="button primary"
                      disabled={!written.trim() || selected !== null}
                      onClick={() => {
                        if (manualQuiz) {
                          setRevealed(true);
                          return;
                        }
                        setSelected(written.trim());
                        props.onReview(
                          card.id,
                          written.trim().toLocaleLowerCase() === card.answer.toLocaleLowerCase(),
                        );
                      }}
                    >
                      {manualQuiz ? t('Reveal study support') : t('Check answer')}{' '}
                    </button>
                  </>
                )}
              </div>
            )}
            {(props.mode === 'recall' || props.mode === 'exam') && (
              <textarea
                autoFocus
                aria-label={t('Your written answer')}
                value={written}
                onChange={(event) => setWritten(event.target.value)}
                disabled={revealed}
                placeholder={t('Close your notes. Put the idea into your own words…')}
              />
            )}
            {props.mode !== 'quiz' && !revealed && (
              <button
                className="button secondary reveal-button"
                disabled={(props.mode === 'recall' || props.mode === 'exam') && !written.trim()}
                onClick={() => setRevealed(true)}
              >
                <Eye size={17} />
                {props.mode === 'flashcards' ? t('Flip card') : t('Compare with notes')}
              </button>
            )}
            {(revealed || selected !== null) && (
              <div className="answer-reveal" role="status">
                <strong>
                  {props.mode === 'quiz' && !manualQuiz
                    ? card.answerStatus === 'ai'
                      ? selected?.toLocaleLowerCase() === card.answer.toLocaleLowerCase()
                        ? t('Your answer matches the AI suggestion.')
                        : t('AI suggests {answer}.', { answer: card.answer })
                      : selected?.toLocaleLowerCase() === card.answer.toLocaleLowerCase()
                        ? t('That’s it!')
                        : t('The answer is {answer}.', { answer: card.answer })
                    : (props.mode === 'exam' ? examCard?.answerStatus : card.answerStatus) === 'ai'
                      ? t('Suggested answer and explanation')
                      : t('Compare with the source')}
                </strong>
                {props.mode === 'exam' ? (
                  visualBlock?.image ? (
                    <img className="source-image" src={visualBlock.image} alt={t('Source image')} />
                  ) : exam.answer ? (
                    <>
                      <p className="actual-answer">{exam.answer}</p>
                      {exam.answerExplanation && <p>{exam.answerExplanation}</p>}
                    </>
                  ) : related.length ? (
                    related.map((relatedCard) => (
                      <p key={relatedCard.id}>
                        {relatedCard.evidence}
                        <small>
                          {deck.sources.find((s) => s.id === relatedCard.sourceId)?.name} ·{' '}
                          {locationLabel(relatedCard.location)}
                        </small>
                      </p>
                    ))
                  ) : (
                    <>
                      <p>{t('No answer has been read or generated yet.')}</p>
                      {examCard && (
                        <button
                          className="button primary"
                          onClick={() => props.onRequestAnswer(examCard.id)}
                        >
                          <Sparkles size={16} />
                          {t('Create answer with AI')}
                        </button>
                      )}
                    </>
                  )
                ) : card.kind === 'image' ? (
                  <>
                    <p>
                      {t(
                        'Compare what you recalled with the original image. You can practice this page without adding notes.',
                      )}
                    </p>
                    <img
                      className="source-image"
                      src={visualBlock?.image}
                      alt={t('Source image')}
                    />
                  </>
                ) : card.answerStatus === 'missing' ? (
                  <>
                    <p>
                      {props.answersPreparing
                        ? t(
                            'The answer is being prepared automatically. This card updates as soon as it is ready.',
                          )
                        : t('No answer has been read or generated yet.')}
                    </p>
                    {!props.answersPreparing && (
                      <button
                        className="button primary"
                        onClick={() => props.onRequestAnswer(card.id)}
                      >
                        <Sparkles size={16} />
                        {t('Create answer with AI')}
                      </button>
                    )}
                    <details>
                      <summary>{t('Original question and alternatives')}</summary>
                      <p className="preserve-lines">{card.evidence}</p>
                    </details>
                  </>
                ) : (
                  <>
                    <p className="preserve-lines actual-answer">
                      {card.kind === 'question' ? card.answer : card.evidence}
                    </p>
                    {card.answerExplanation && (
                      <p className="answer-explanation">{card.answerExplanation}</p>
                    )}
                    {card.answerStatus === 'ai' && (
                      <small>
                        {card.answerBasis === 'material'
                          ? t('Based on supplied material · AI interpretation')
                          : t('Based on general knowledge · AI suggestion')}
                        {' · '}
                        {card.answerModel}
                      </small>
                    )}
                    {card.answerReference && (
                      <details>
                        <summary>{t('Supporting source excerpt')}</summary>
                        <p>{card.answerReference.quote}</p>
                        <small>
                          {
                            deck.sources.find(
                              (source) => source.id === card.answerReference?.sourceId,
                            )?.name
                          }{' '}
                          · {locationLabel(card.answerReference.location)}
                        </small>
                      </details>
                    )}
                  </>
                )}
                {props.mode === 'recall' && card.answerStatus !== 'missing' && (
                  <small>
                    {
                      keywords(card.kind === 'question' ? card.answer : card.evidence).filter(
                        (token) => keywords(written).includes(token),
                      ).length
                    }{' '}
                    {t(
                      'source keywords appear in your answer. This is a hint, not an automatic grade.',
                    )}{' '}
                  </small>
                )}
                {props.mode === 'exam' && (
                  <small>{t('Related notes are suggestions, not a verified marking guide.')}</small>
                )}
              </div>
            )}
          </div>
          {(revealed || selected !== null) && (
            <div className="answer-actions">
              {unavailable ? (
                <button
                  className="button secondary"
                  onClick={() => {
                    skippedInRound.current++;
                    next(false, false);
                  }}
                >
                  {t('Skip question')} <ArrowRight size={16} />
                </button>
              ) : props.mode === 'quiz' && !manualQuiz ? (
                <button
                  className="button primary"
                  onClick={() =>
                    next(selected?.toLocaleLowerCase() === card.answer.toLocaleLowerCase(), false)
                  }
                >
                  {index + 1 === total ? t('See results') : t('Next question')}
                  <ArrowRight size={16} />
                </button>
              ) : (
                <>
                  <p className="muted">{t('How did you do?')}</p>
                  <button
                    className="button secondary"
                    onClick={() => next(false, props.mode !== 'exam')}
                  >
                    <RotateCcw size={16} /> {t('Needs practice')}{' '}
                  </button>
                  <button
                    className="button primary"
                    onClick={() => next(true, props.mode !== 'exam')}
                  >
                    <Check size={16} /> {t('Got it')}{' '}
                  </button>
                </>
              )}
            </div>
          )}
          {props.mode !== 'exam' && (
            <details
              className="source-detail"
              open={sourceOpen}
              onToggle={(event) => setSourceOpen(event.currentTarget.open)}
            >
              <summary>
                <Flag size={14} /> {t('Source ·')}{' '}
                {deck.sources.find((s) => s.id === card.sourceId)?.name} ·{' '}
                {locationLabel(card.location)}
              </summary>
              <p>{card.evidence}</p>
            </details>
          )}
          {props.mode === 'flashcards' && (
            <small className="keyboard-hint">{t('Tip: press space to flip the card')}</small>
          )}
        </>
      )}
      {started && !complete && (
        <button className="text-button end-session" onClick={props.onClose}>
          <X size={15} /> {t('End session')}{' '}
        </button>
      )}
    </div>
  );
}
