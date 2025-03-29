import { DashboardLayout } from '@toolpad/core/DashboardLayout'
import { PageContainer } from '@toolpad/core/PageContainer'
import * as React from 'react'

export default function Layout(props: { children: React.ReactNode }) {
  return (
    <DashboardLayout>
      <PageContainer>{props.children}</PageContainer>
    </DashboardLayout>
  )
}
