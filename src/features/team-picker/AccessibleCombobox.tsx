import { ChevronDown, Search } from 'lucide-react';
import { useId, useState, type KeyboardEvent } from 'react';
import './TeamPicker.scss';

interface ComboboxOption {
  id: number;
  label: string;
  secondaryLabel?: string;
}

interface AccessibleComboboxProps {
  label: string;
  placeholder: string;
  query: string;
  options: ComboboxOption[];
  selectedId: number | null;
  disabled?: boolean;
  describedBy?: string;
  onQueryChange: (query: string) => void;
  onSelect: (id: number) => void;
}

export function AccessibleCombobox({ label, placeholder, query, options, selectedId, disabled = false, describedBy, onQueryChange, onSelect }: AccessibleComboboxProps) {
  const listboxId = useId();
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const visibleOptions = options.slice(0, 40);
  const safeActiveIndex = Math.min(activeIndex, Math.max(visibleOptions.length - 1, 0));
  const activeOption = open ? visibleOptions[safeActiveIndex] : undefined;

  const selectOption = (id: number) => {
    onSelect(id);
    setOpen(false);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((current) => Math.min(current + 1, Math.max(visibleOptions.length - 1, 0)));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((current) => Math.max(current - 1, 0));
    } else if (event.key === 'Enter' && activeOption) {
      event.preventDefault();
      selectOption(activeOption.id);
    } else if (event.key === 'Escape') {
      setOpen(false);
    }
  };

  return <label className="team-picker__field">
    <span>{label}</span>
    <div className="team-picker__combobox">
      <Search size={16} aria-hidden="true" />
      <input
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-activedescendant={activeOption ? `${listboxId}-${activeOption.id}` : undefined}
        aria-describedby={describedBy}
        autoComplete="off"
        disabled={disabled}
        placeholder={placeholder}
        value={query}
        onChange={(event) => {
          onQueryChange(event.target.value);
          setActiveIndex(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={handleKeyDown}
      />
      <ChevronDown size={16} aria-hidden="true" />
      {open && !disabled && visibleOptions.length > 0 ? <div className="team-picker__options" id={listboxId} role="listbox">
        {visibleOptions.map((option, index) => <button
          className={index === safeActiveIndex ? 'team-picker__option team-picker__option--active' : 'team-picker__option'}
          id={`${listboxId}-${option.id}`}
          role="option"
          aria-selected={option.id === selectedId}
          type="button"
          key={option.id}
          tabIndex={-1}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => selectOption(option.id)}
        ><strong>{option.label}</strong>{option.secondaryLabel ? <small>{option.secondaryLabel}</small> : null}</button>)}
      </div> : null}
    </div>
  </label>;
}
