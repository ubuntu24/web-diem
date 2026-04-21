import { render, screen } from '@testing-library/react'
import Dashboard from '../app/Dashboard'
import { vi, describe, it, expect } from 'vitest'

// We need to mock Framer Motion if it causes issues in JSDOM
vi.mock('framer-motion', () => {
  const React = require('react');
  const ActualMotion = {
    div: (props: any) => React.createElement('div', props),
    button: (props: any) => React.createElement('button', props),
    h1: (props: any) => React.createElement('h1', props),
    p: (props: any) => React.createElement('p', props),
    span: (props: any) => React.createElement('span', props),
    nav: (props: any) => React.createElement('nav', props),
    section: (props: any) => React.createElement('section', props),
    article: (props: any) => React.createElement('article', props),
    header: (props: any) => React.createElement('header', props),
    footer: (props: any) => React.createElement('footer', props),
  };
  
  return {
    motion: ActualMotion,
    AnimatePresence: ({ children }: any) => React.createElement(React.Fragment, null, children),
  };
})

describe('Dashboard Branding', () => {
  it('renders the lifesuck logo correctly', () => {
    render(<Dashboard />)
    const logoElement = screen.getByText(/LIFESUCK/i)
    expect(logoElement).toBeDefined()
  })
})
