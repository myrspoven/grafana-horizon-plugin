import React, { ChangeEvent } from 'react';
import { StandardEditorProps } from '@grafana/data';
import { css } from '@emotion/css';
import { useStyles2 } from '@grafana/ui';

const getStyles = () => ({
  textarea: css`
    background: var(--input-bg, #111217);
    border: 1px solid var(--input-border-color, #2f333d);
    border-radius: 2px;
    color: inherit;
    font-family: monospace;
    min-height: 220px;
    padding: 8px;
    resize: vertical;
    width: 100%;
  `,
});

export function ExploreJsonEditor({ value, onChange }: StandardEditorProps<string>) {
  const styles = useStyles2(getStyles);

  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    onChange(event.currentTarget.value);
  };

  return (
    <textarea
      className={styles.textarea}
      rows={12}
      value={value ?? ''}
      onChange={handleChange}
      placeholder='{"datasource":"uid","queries":[],"range":{"from":"${fromIso}","to":"${toIso}"}}'
      spellCheck={false}
    />
  );
}
