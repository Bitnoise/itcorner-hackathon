import { expect, test } from '@playwright/test';

const DOCTOR_EMAIL = 'dr.kowalski@clinic.pl';
const DOCTOR_PASSWORD = 'Pass1234!';
const PATIENT_EMAIL = 'p.zielinski@mail.pl';
const PATIENT_PASSWORD = 'Pass1234!';

test.describe('Authentication', () => {
  test('doctor can log in and reaches /doctor dashboard', async ({ page }) => {
    await page.goto('/login');

    await page.getByLabel('Email').fill(DOCTOR_EMAIL);
    await page.getByLabel('Password').fill(DOCTOR_PASSWORD);
    await page.getByRole('button', { name: /sign in/i }).click();

    await page.waitForURL('**/doctor', { timeout: 10_000 });
    await expect(page.getByText(/Welcome/i)).toBeVisible();
    await expect(page.getByText('Upcoming appointments')).toBeVisible();
  });

  test('patient can log in and reaches /patient dashboard', async ({ page }) => {
    await page.goto('/login');

    await page.getByLabel('Email').fill(PATIENT_EMAIL);
    await page.getByLabel('Password').fill(PATIENT_PASSWORD);
    await page.getByRole('button', { name: /sign in/i }).click();

    await page.waitForURL('**/patient', { timeout: 10_000 });
    await expect(page.getByText(/Welcome/i)).toBeVisible();
    await expect(page.getByText('Upcoming appointments')).toBeVisible();
  });

  test('wrong credentials show an error message', async ({ page }) => {
    await page.goto('/login');

    await page.getByLabel('Email').fill(DOCTOR_EMAIL);
    await page.getByLabel('Password').fill('wrong-password');
    await page.getByRole('button', { name: /sign in/i }).click();

    await expect(page.getByText(/invalid credentials/i)).toBeVisible({ timeout: 5_000 });
    await expect(page).toHaveURL(/\/login/);
  });

  test('logged-in doctor can log out and is returned to /login', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(DOCTOR_EMAIL);
    await page.getByLabel('Password').fill(DOCTOR_PASSWORD);
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL('**/doctor');

    await page.getByRole('button', { name: /log out/i }).click();

    await page.waitForURL('**/login', { timeout: 5_000 });
  });

  test('session survives a page refresh', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(PATIENT_EMAIL);
    await page.getByLabel('Password').fill(PATIENT_PASSWORD);
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL('**/patient');

    await page.reload();

    await expect(page).toHaveURL(/\/patient/);
    await expect(page.getByText(/Welcome/i)).toBeVisible();
  });

  test('unauthenticated visitor is redirected to /login', async ({ page }) => {
    await page.goto('/patient');

    await page.waitForURL('**/login', { timeout: 5_000 });
  });

  test('doctor redirected away from /patient to /doctor', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(DOCTOR_EMAIL);
    await page.getByLabel('Password').fill(DOCTOR_PASSWORD);
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL('**/doctor');

    await page.goto('/patient');

    await page.waitForURL('**/doctor', { timeout: 5_000 });
  });

  test('patient redirected away from /doctor to /patient', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(PATIENT_EMAIL);
    await page.getByLabel('Password').fill(PATIENT_PASSWORD);
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL('**/patient');

    await page.goto('/doctor');

    await page.waitForURL('**/patient', { timeout: 5_000 });
  });

  test('logged-in doctor visiting /login is redirected to /doctor', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(DOCTOR_EMAIL);
    await page.getByLabel('Password').fill(DOCTOR_PASSWORD);
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL('**/doctor');

    await page.goto('/login');

    await page.waitForURL('**/doctor', { timeout: 5_000 });
  });

  test('logged-in patient visiting /login is redirected to /patient', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(PATIENT_EMAIL);
    await page.getByLabel('Password').fill(PATIENT_PASSWORD);
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL('**/patient');

    await page.goto('/login');

    await page.waitForURL('**/patient', { timeout: 5_000 });
  });
});
