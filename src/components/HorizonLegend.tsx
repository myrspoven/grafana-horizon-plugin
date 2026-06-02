import React, { KeyboardEvent } from 'react';
import { css, cx } from '@emotion/css';
import { useStyles2, useTheme2 } from '@grafana/ui';

export interface HorizonLegendRow {
  color: string;
  id: string;
  isHidden: boolean;
  last: string;
  max: string;
  name: string;
}

interface HorizonLegendProps {
  height: number;
  isBottom: boolean;
  marginLeft: number;
  onToggle: (seriesId: string) => void;
  rows: HorizonLegendRow[];
  width: number;
}

const getLegendStyles = () => ({
  legend: css`
    display: grid;
    gap: 4px;
    grid-template-columns: 1fr 48px 48px;
    overflow: hidden;
    position: absolute;
  `,
  legendHeader: css`
    font-size: 11px;
    font-weight: 600;
    line-height: 16px;
    text-align: right;
  `,
  legendName: css`
    align-items: center;
    display: flex;
    font-size: 11px;
    gap: 8px;
    line-height: 16px;
    min-width: 0;
  `,
  legendSwatch: css`
    flex: 0 0 auto;
    height: 3px;
    width: 14px;
  `,
  legendText: css`
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
  legendValue: css`
    font-size: 11px;
    line-height: 16px;
    text-align: right;
  `,
  legendToggle: css`
    cursor: pointer;
    user-select: none;

    &:focus-visible {
      outline: 1px solid currentColor;
      outline-offset: 2px;
    }
  `,
  legendHidden: css`
    opacity: 0.38;
  `,
});

export function HorizonLegend({ height, isBottom, marginLeft, onToggle, rows, width }: HorizonLegendProps) {
  const theme = useTheme2();
  const styles = useStyles2(getLegendStyles);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>, seriesId: string) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onToggle(seriesId);
    }
  };

  return (
    <div
      data-testid="horizon-legend"
      className={styles.legend}
      style={
        isBottom
          ? {
              bottom: 4,
              color: theme.colors.text.secondary,
              left: marginLeft,
              maxHeight: height - 6,
              right: 8,
            }
          : {
              color: theme.colors.text.secondary,
              right: 8,
              top: 8,
              width,
            }
      }
    >
      <div />
      <div className={styles.legendHeader}>Last</div>
      <div className={styles.legendHeader}>Max</div>

      {rows.map((row) => {
        const toggleClassName = cx(styles.legendToggle, row.isHidden && styles.legendHidden);
        const title = `${row.isHidden ? 'Show' : 'Hide'} ${row.name}`;

        return (
          <React.Fragment key={row.id}>
            <div
              aria-pressed={!row.isHidden}
              className={cx(styles.legendName, toggleClassName)}
              onClick={() => onToggle(row.id)}
              onKeyDown={(event) => handleKeyDown(event, row.id)}
              role="button"
              tabIndex={0}
              title={title}
            >
              <span className={styles.legendSwatch} style={{ background: row.color }} />
              <span className={styles.legendText}>{row.name}</span>
            </div>
            <div
              className={cx(styles.legendValue, toggleClassName)}
              onClick={() => onToggle(row.id)}
              onKeyDown={(event) => handleKeyDown(event, row.id)}
              role="button"
              tabIndex={0}
              title={title}
            >
              {row.last}
            </div>
            <div
              className={cx(styles.legendValue, toggleClassName)}
              onClick={() => onToggle(row.id)}
              onKeyDown={(event) => handleKeyDown(event, row.id)}
              role="button"
              tabIndex={0}
              title={title}
            >
              {row.max}
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
}
