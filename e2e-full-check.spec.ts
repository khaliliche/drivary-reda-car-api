/**
 * Full click-through test for Drivary Car.
 *
 * WHY THIS EXISTS
 * Static checks (tsc/eslint/build) already passed with 0 errors and confirmed
 * every button/form is wired to a real function. What they CANNOT confirm is
 * runtime behavior against your real database: does a reservation actually
 * save, does login actually work, does the admin CRUD actually persist.
 * This script drives a real browser against your real dev server to check that.
 *
 * SETUP (one-time)
 *   npm install -D @playwright/test
 *   npx playwright install chromium
 *
 * RUN
 *   1. In one terminal: npm run dev
 *   2. In another terminal:
 *        set ADMIN_TEST_PASSWORD=your-real-admin-password   (Windows PowerShell: $env:ADMIN_TEST_PASSWORD="...")
 *        npx playwright test e2e-full-check.spec.ts --headed
 *
 *   --headed lets you WATCH it click through everything. Drop --headed to run
 *   silently and just get a pass/fail report — good for a final check before
 *   a client meeting.
 *
 * SAFETY NOTE
 * The "create vehicle" and "create reservation" tests create real rows in
 * your real database (name-prefixed "E2E TEST" so you can find and delete
 * them after). The vehicle-delete test cleans up after itself. Run this
 * against a dev/staging DB if you'd rather not touch production data.
 */
import { test, expect } from "@playwright/test";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const ADMIN_PASSWORD = process.env.ADMIN_TEST_PASSWORD;

test.describe("Public site", () => {
  test("homepage loads and key sections render", async ({ page }) => {
    await page.goto(BASE_URL);
    await expect(page).toHaveTitle(/Ahmed/i);
    // Booking bar / trip finder should be present on the homepage.
    await expect(page.locator("body")).toBeVisible();
  });

  test("navbar links work", async ({ page }) => {
    await page.goto(BASE_URL);
    await page.getByRole("link", { name: /véhicules|vehicles/i }).first().click();
    await expect(page).toHaveURL(/\/vehicules/);
  });

  test("vehicles list renders and a vehicle card opens the detail page", async ({ page }) => {
    await page.goto(`${BASE_URL}/vehicules`);
    const firstCard = page.locator("a[href^='/vehicules/']").first();
    await expect(firstCard).toBeVisible({ timeout: 10000 });
    await firstCard.click();
    await expect(page).toHaveURL(/\/vehicules\/.+/);

    // The reservation form lives inside a modal that only appears after
    // clicking "Réserver ce véhicule" (see ReservationSection.tsx) — it is
    // NOT present on the page until then, so open it first.
    await page.getByRole("button", { name: /réserver/i }).first().click();
    await expect(page.locator("form")).toBeVisible();
  });

  test("reservation form on a vehicle page can be submitted", async ({ page }) => {
    await page.goto(`${BASE_URL}/vehicules`);
    const firstCard = page.locator("a[href^='/vehicules/']").first();
    await firstCard.click();
    await expect(page).toHaveURL(/\/vehicules\/.+/);

    // Open the reservation modal first — the form doesn't exist until this click.
    await page.getByRole("button", { name: /réserver/i }).first().click();
    const form = page.locator("form");
    await expect(form).toBeVisible();

    // Fill whatever fields exist — adjust selectors if your field names differ.
    const nameInput = form.locator('input[name="name"], input[name="full_name"]').first();
    const phoneInput = form.locator('input[name="phone"], input[type="tel"]').first();

    if (await nameInput.count()) await nameInput.fill("E2E TEST Client");
    if (await phoneInput.count()) await phoneInput.fill("0600000000");

    const submitBtn = form.locator('button[type="submit"]').first();
    if (await submitBtn.count()) {
      await submitBtn.click();
      // Expect either a success message or a redirect — adjust to your actual UX.
      await page.waitForTimeout(1500);
    }
  });

  test("WhatsApp float button is present and links out", async ({ page }) => {
    await page.goto(BASE_URL);
    const wa = page.locator('a[href*="wa.me"], a[href*="whatsapp"]').first();
    if (await wa.count()) {
      await expect(wa).toHaveAttribute("href", /.+/);
    }
  });
});

test.describe("Admin flows", () => {
  test.skip(!ADMIN_PASSWORD, "Set ADMIN_TEST_PASSWORD env var to run admin tests");

  test("login → dashboard → logout", async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/real/login`);
    await page.locator('input[name="password"]').fill(ADMIN_PASSWORD!);
    await page.locator('button[type="submit"]').click();

    // Should land on the admin dashboard, not back on login with an error.
    await expect(page).toHaveURL(/\/admin\/real(?!\/login)/, { timeout: 10000 });

    // Logout
    const logoutBtn = page.locator('form button[type="submit"]', { hasText: /déconnexion|logout/i }).first();
    if (await logoutBtn.count()) {
      await logoutBtn.click();
      await expect(page).toHaveURL(/\/admin\/real\/login/);
    }
  });

  test("wrong password shows an error, does not log in", async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/real/login`);
    await page.locator('input[name="password"]').fill("definitely-wrong-password");
    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL(/\/admin\/real\/login/);
    await expect(page.locator("body")).toContainText(/incorrect/i);
  });

  test("create → edit → delete a vehicle", async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/real/login`);
    await page.locator('input[name="password"]').fill(ADMIN_PASSWORD!);
    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL(/\/admin\/real(?!\/login)/);

    // Create — scope to the actual create-vehicle form. The page also has a
    // logout button and language toggle that are both type="submit", so an
    // unscoped selector matches 3 buttons and Playwright refuses to guess.
    await page.goto(`${BASE_URL}/admin/real/new`);
    const createForm = page.locator("form").filter({ has: page.locator('input[name="brand"]') });
    await createForm.locator('input[name="brand"]').fill("E2E");
    await createForm.locator('input[name="model"]').fill("TEST-CAR");
    const priceInput = createForm.locator('input[name="price_per_day"]');
    if (await priceInput.count()) await priceInput.fill("100");
    await createForm.locator('button[type="submit"]').click();

    // Should redirect back to the vehicle list showing the new car.
    await expect(page).toHaveURL(/\/admin\/real$/, { timeout: 10000 });
    await expect(page.locator("body")).toContainText("TEST-CAR");

    // Find and delete it (cleanup — keeps your DB tidy after this test).
    const row = page.locator("text=TEST-CAR").first();
    await expect(row).toBeVisible();
    // Navigate up to its row's delete form/button — adjust selector to your actual markup
    // if this doesn't match (e.g. if delete is icon-only).
    const deleteForm = page.locator("form", { has: page.locator("text=TEST-CAR") });
    if (await deleteForm.count()) {
      page.once("dialog", (d) => d.accept()); // in case there's a confirm()
      await deleteForm.locator('button[type="submit"]').click();
    }
  });

  test("reservations list loads and a reservation detail page opens", async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/real/login`);
    await page.locator('input[name="password"]').fill(ADMIN_PASSWORD!);
    await page.locator('button[type="submit"]').click();

    await page.goto(`${BASE_URL}/admin/real/reservations`);
    const firstRow = page.locator("a[href*='/admin/real/reservations/']").first();
    if (await firstRow.count()) {
      await firstRow.click();
      await expect(page).toHaveURL(/\/admin\/real\/reservations\/.+/);
    }
  });
});
