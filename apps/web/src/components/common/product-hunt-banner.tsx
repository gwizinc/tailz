'use client'

/**
 * use by
 * import { ProductHuntBanner } from '@/components/common/product-hunt-banner'
 * <ProductHuntBanner client:load />
 */
import { ArrowUpRight, Megaphone } from 'lucide-react'
import type { HTMLAttributes } from 'react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface ProductHuntBannerProps extends HTMLAttributes<HTMLDivElement> {
  href?: string
}

const DEFAULT_PRODUCT_HUNT_URL = 'https://www.producthunt.com/posts/kyoto'

export function ProductHuntBanner({
  className,
  href = DEFAULT_PRODUCT_HUNT_URL,
  ...props
}: ProductHuntBannerProps) {
  return (
    <div
      className={cn(
        'w-full border-b border-primary/20 bg-primary/10 text-sm',
        className,
      )}
      {...props}
    >
      <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-3 px-4 py-3 text-center sm:flex-row sm:justify-between sm:text-left">
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-center sm:gap-4">
          <img
            src="/product-hunt-cat.png"
            alt="Product Hunt cat mascot"
            className="h-12 w-12 rounded-full border border-primary/30 bg-background shadow-sm"
            loading="lazy"
            width={48}
            height={48}
          />
          <div className="flex flex-col items-center gap-1 sm:items-start">
            <span className="inline-flex items-center gap-2 font-semibold text-primary">
              <Megaphone className="h-4 w-4" aria-hidden="true" />
              We&apos;re Live on Product Hunt!
            </span>
            <span className="text-sm text-muted-foreground">
              Support us with an upvote or comment.
            </span>
          </div>
        </div>
        <Button asChild size="sm" className="w-full sm:w-auto">
          <a href={href} target="_blank" rel="noreferrer noopener">
            Upvote Now
            <ArrowUpRight className="ml-2 h-4 w-4" aria-hidden="true" />
            <span className="sr-only">Opens Product Hunt in a new tab</span>
          </a>
        </Button>
      </div>
    </div>
  )
}
