import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Mocking Next.js router if needed
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => '/',
}))
