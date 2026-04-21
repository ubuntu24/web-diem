import { render, screen } from '@testing-library/react'
import Dashboard from '../app/Dashboard'
import { vi, describe, it, expect } from 'vitest'

// We need to mock Framer Motion if it causes issues in JSDOM
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    h1: ({ children, ...props }: any) => <h1 {...props}>{children}</h1>,
    p: ({ children, ...props }: any) => <p {...props}>{children}</p>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}))

describe('Dashboard Branding', () => {
  it('renders the lifesuck logo correctly', () => {
    render(<Dashboard />)
    const logoElement = screen.getByText(/LIFESUCK/i)
    expect(logoElement).toBeDefined()
  })
})
