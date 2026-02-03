import { forwardRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, X, Check } from 'lucide-react';
import { Spinner, TooltipAnchor } from '@librechat/client';
import { useLocalize } from '~/hooks';
import { cn } from '~/utils';

type DictateButtonState = 'idle' | 'recording' | 'transcribing';

interface DictateButtonProps {
  state: DictateButtonState;
  disabled?: boolean;
  onStartRecording: () => void;
  onCancelRecording: () => void;
  onConfirmRecording: () => void;
}

const iconVariants = {
  initial: { scale: 0, opacity: 0, rotate: -90 },
  animate: { scale: 1, opacity: 1, rotate: 0 },
  exit: { scale: 0, opacity: 0, rotate: 90 },
};

const DictateButton = forwardRef<HTMLDivElement, DictateButtonProps>(
  ({ state, disabled = false, onStartRecording, onCancelRecording, onConfirmRecording }, ref) => {
    const localize = useLocalize();

    // Idle state: single mic button
    if (state === 'idle') {
      return (
        <div ref={ref}>
          <TooltipAnchor
            description={localize('com_ui_use_micrphone')}
            render={
              <motion.button
                type="button"
                aria-label={localize('com_ui_use_micrphone')}
                onClick={onStartRecording}
                disabled={disabled}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={cn(
                  'flex size-9 items-center justify-center rounded-full p-1.5',
                  'text-text-secondary transition-colors duration-150',
                  'hover:bg-surface-hover hover:text-text-primary',
                  'disabled:cursor-not-allowed disabled:opacity-40',
                )}
              >
                <Mic className="size-5" strokeWidth={1.75} />
              </motion.button>
            }
          />
        </div>
      );
    }

    // Recording/Transcribing state: cancel + confirm buttons
    return (
      <motion.div
        ref={ref}
        initial={{ opacity: 0, x: 10 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 10 }}
        transition={{ duration: 0.15 }}
        className="flex items-center gap-1"
      >
        {/* Cancel button */}
        <TooltipAnchor
          description={localize('com_ui_cancel') || 'Cancel'}
          render={
            <motion.button
              type="button"
              aria-label={localize('com_ui_cancel') || 'Cancel'}
              onClick={onCancelRecording}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className={cn(
                'flex size-9 items-center justify-center rounded-full p-1.5',
                'text-text-secondary transition-all duration-150',
                'hover:bg-red-500/10 hover:text-red-500',
              )}
            >
              <X className="size-5" strokeWidth={1.75} />
            </motion.button>
          }
        />

        {/* Confirm/Submit button */}
        <TooltipAnchor
          description={state === 'transcribing' ? localize('com_ui_loading') : localize('com_ui_confirm')}
          render={
            <motion.button
              type="button"
              aria-label={localize('com_ui_confirm') || 'Confirm'}
              onClick={onConfirmRecording}
              disabled={state === 'transcribing'}
              whileHover={state !== 'transcribing' ? { scale: 1.05 } : undefined}
              whileTap={state !== 'transcribing' ? { scale: 0.95 } : undefined}
              className={cn(
                'flex size-9 items-center justify-center rounded-full p-1.5',
                'transition-all duration-200',
                state === 'transcribing'
                  ? 'bg-surface-tertiary text-text-secondary'
                  : 'bg-text-primary text-surface-primary hover:opacity-90',
                'disabled:cursor-not-allowed',
              )}
            >
              <AnimatePresence mode="wait">
                {state === 'transcribing' ? (
                  <motion.div
                    key="spinner"
                    variants={iconVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    transition={{ duration: 0.15 }}
                  >
                    <Spinner className="size-5" />
                  </motion.div>
                ) : (
                  <motion.div
                    key="check"
                    variants={iconVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    transition={{ duration: 0.15 }}
                  >
                    <Check className="size-5" strokeWidth={2} />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.button>
          }
        />
      </motion.div>
    );
  },
);

DictateButton.displayName = 'DictateButton';

export default DictateButton;
