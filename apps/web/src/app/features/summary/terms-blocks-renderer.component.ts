/**
 * TermsBlocksRendererComponent — safely renders Strapi Blocks content.
 * Uses Angular template binding only — zero innerHTML, zero DomSanitizer (ADR-009 D3-A).
 * Supports: paragraph, heading (level 2/3), list (ordered/unordered), quote.
 * Inline marks: bold → <strong>, italic → <em>, link → <a> (safe URLs only).
 * Unknown blocks are omitted + logged (ADR-009 D5-A).
 * AC-03.3, AC-03.14
 */
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { Block, InlineNode, TextNode } from '../../core/schemas/terms.schema';
import { isSafeUrl } from '../../core/url-safety';

/**
 * Renders a single inline node: text (with optional bold/italic) or a safe link.
 * Uses template binding only — no innerHTML (ADR-009 D3-A).
 */
@Component({
  selector: 'app-inline-node',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (node().type === 'link' && safeUrl()) {
      <a
        [attr.href]="linkUrl()"
        rel="noopener noreferrer"
        target="_blank"
        class="terms-link"
      >
        @for (child of linkChildren(); track $index) {
          @if (child.bold && child.italic) {
            <strong><em>{{ child.text }}</em></strong>
          } @else if (child.bold) {
            <strong>{{ child.text }}</strong>
          } @else if (child.italic) {
            <em>{{ child.text }}</em>
          } @else {
            {{ child.text }}
          }
        }
      </a>
    } @else if (node().type === 'link' && !safeUrl()) {
      @for (child of linkChildren(); track $index) {
        {{ child.text }}
      }
    } @else if (node().type === 'text') {
      @if (textBold() && textItalic()) {
        <strong><em>{{ textContent() }}</em></strong>
      } @else if (textBold()) {
        <strong>{{ textContent() }}</strong>
      } @else if (textItalic()) {
        <em>{{ textContent() }}</em>
      } @else {
        {{ textContent() }}
      }
    }
  `,
  styles: [`
    :host { display: contents; }
    .terms-link {
      color: var(--color-primary, #1a56db);
      text-decoration: underline;
      &:hover { text-decoration: none; }
      &:focus-visible {
        outline: 2px solid var(--color-primary, #1a56db);
        outline-offset: 2px;
        border-radius: 2px;
      }
    }
  `],
})
export class InlineNodeComponent {
  readonly node = input.required<InlineNode>();

  protected safeUrl(): boolean {
    const n = this.node();
    return n.type === 'link' && isSafeUrl(n.url);
  }

  protected linkUrl(): string | null {
    const n = this.node();
    return n.type === 'link' ? n.url : null;
  }

  protected linkChildren(): TextNode[] {
    const n = this.node();
    return n.type === 'link' ? n.children : [];
  }

  protected textContent(): string {
    const n = this.node();
    return n.type === 'text' ? n.text : '';
  }

  protected textBold(): boolean {
    const n = this.node();
    return n.type === 'text' ? (n.bold ?? false) : false;
  }

  protected textItalic(): boolean {
    const n = this.node();
    return n.type === 'text' ? (n.italic ?? false) : false;
  }
}

/**
 * Main renderer for a list of Strapi Blocks.
 * Input: blocks: Block[] — a typed array of supported block nodes.
 */
@Component({
  selector: 'app-terms-blocks-renderer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [InlineNodeComponent],
  template: `
    @for (block of blocks(); track $index) {
      @switch (block.type) {
        @case ('paragraph') {
          <p class="terms-paragraph">
            @for (child of block.children; track $index) {
              <app-inline-node [node]="child" />
            }
          </p>
        }
        @case ('heading') {
          @if (block.level === 2) {
            <h2 class="terms-heading terms-heading--2">
              @for (child of block.children; track $index) {
                <app-inline-node [node]="child" />
              }
            </h2>
          }
          @if (block.level === 3) {
            <h3 class="terms-heading terms-heading--3">
              @for (child of block.children; track $index) {
                <app-inline-node [node]="child" />
              }
            </h3>
          }
        }
        @case ('list') {
          @if (block.format === 'unordered') {
            <ul class="terms-list terms-list--unordered">
              @for (item of block.children; track $index) {
                <li class="terms-list-item">
                  @for (child of item.children; track $index) {
                    <app-inline-node [node]="child" />
                  }
                </li>
              }
            </ul>
          }
          @if (block.format === 'ordered') {
            <ol class="terms-list terms-list--ordered">
              @for (item of block.children; track $index) {
                <li class="terms-list-item">
                  @for (child of item.children; track $index) {
                    <app-inline-node [node]="child" />
                  }
                </li>
              }
            </ol>
          }
        }
        @case ('quote') {
          <blockquote class="terms-quote">
            @for (child of block.children; track $index) {
              <app-inline-node [node]="child" />
            }
          </blockquote>
        }
        @default {
          <!-- Unknown block type: omit silently (ADR-009 D5-A — sanitizeBlocks already filtered) -->
        }
      }
    }
  `,
  styles: [`
    :host { display: block; }

    .terms-paragraph {
      margin: 0 0 var(--space-md, 1rem);
      line-height: 1.6;
    }

    .terms-heading {
      margin: var(--space-lg, 1.5rem) 0 var(--space-sm, 0.5rem);
      font-weight: 600;
      line-height: 1.3;
    }

    .terms-heading--2 { font-size: var(--font-size-lg, 1.25rem); }
    .terms-heading--3 { font-size: var(--font-size-base, 1rem); }

    .terms-list {
      margin: 0 0 var(--space-md, 1rem);
      padding-left: var(--space-lg, 1.5rem);
    }

    .terms-list-item {
      margin-bottom: var(--space-xs, 0.25rem);
      line-height: 1.6;
    }

    .terms-quote {
      border-left: 4px solid var(--color-border, #ccc);
      margin: 0 0 var(--space-md, 1rem);
      padding: var(--space-sm, 0.5rem) var(--space-md, 1rem);
      font-style: italic;
      color: var(--color-text-secondary, #555);
    }
  `],
})
export class TermsBlocksRendererComponent {
  readonly blocks = input.required<Block[]>();

}
