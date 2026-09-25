import { NextRequest, NextResponse } from "next/server";
import { createReservation, getVehicleById } from "@/lib/db";
import { daysBetween, isRentalDurationValid, DEFAULT_MIN_RENTAL_DAYS } from "@/lib/contract";
import { getClientIp, checkReservationLimit } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const allowed = await checkReservationLimit(`res:${getClientIp(request.headers)}`);
  if (!allowed) {
    return NextResponse.json({ success: false, errorCode: "rateLimited" }, { status: 429 });
  }

  const body = await request.json();

  const {
    vehicle_id: vehicleId,
        prenom,
    nom,
    date_naissance: dateNaissance,
    cin_number: cinNumber,
    cin_delivered_le: cinDeliveredLe = null,
    license_issue_date: licenseIssueDate,
    driver_address: driverAddress,
    driver_phone: driverPhone,
    driver_license_number: driverLicenseNumber,
    driver_passport_number: driverPassportNumber,
    passport_delivered_le: passportDeliveredLe,
    has_second_driver: hasSecondDriver,
    second_driver_prenom: secondDriverPrenom = "",
    second_driver_nom: secondDriverNom = "",
    second_driver_date_naissance: secondDriverDateNaissance = null,
    second_driver_address: secondDriverAddress = "",
    second_driver_phone: secondDriverPhone = "",
    second_driver_cin_number: secondDriverCinNumber = "",
    second_driver_cin_delivered_le: secondDriverCinDeliveredLe = null,
    second_driver_license_number: secondDriverLicenseNumber = "",
    second_driver_passport_number: secondDriverPassportNumber = "",
    second_driver_passport_delivered_le: secondDriverPassportDeliveredLe = null,
    start_date: startDate,
    end_date: endDate,
    start_time: startTime,
    end_time: endTime,
  } = body;

  if (
    !vehicleId || !prenom || !nom || !dateNaissance || !cinNumber || !licenseIssueDate ||
    !driverAddress || !driverPhone || !driverLicenseNumber || !driverPassportNumber || !passportDeliveredLe ||
    !startDate || !endDate || !startTime || !endTime
  ) {
    return NextResponse.json({ success: false, errorCode: "missingFields" }, { status: 400 });
  }
  // cin_delivered_le is intentionally optional for online clients (not every
  // renter has that date handy) — the admin can fill it in later.
  if (
    hasSecondDriver &&
    (!secondDriverPrenom || !secondDriverNom || !secondDriverCinNumber || !secondDriverDateNaissance)
  ) {
    return NextResponse.json({ success: false, errorCode: "missingFields" }, { status: 400 });
  }
  if (new Date(endDate) <= new Date(startDate)) {
    return NextResponse.json({ success: false, errorCode: "invalidDateRange" }, { status: 400 });
  }
  if (new Date(licenseIssueDate) > new Date()) {
    return NextResponse.json({ success: false, errorCode: "licenseDateInFuture" }, { status: 400 });
  }

  const vehicle = await getVehicleById(Number(vehicleId));
  if (!vehicle) {
    return NextResponse.json({ success: false, errorCode: "vehicleNotFound" }, { status: 404 });
  }

  const minDays = vehicle.min_rental_days ?? DEFAULT_MIN_RENTAL_DAYS;
  const requestedDays = daysBetween(startDate, endDate);
  if (!isRentalDurationValid(requestedDays, minDays)) {
    return NextResponse.json(
      { success: false, errorCode: "minRentalDays", errorParams: { min: minDays, days: requestedDays } },
      { status: 400 }
    );
  }

  const vehicleLabel = `${vehicle.brand} ${vehicle.model}`;

  await createReservation({
    vehicle_id: vehicle.id,
    vehicle_label: vehicleLabel,
        prenom,
    nom,
    date_naissance: dateNaissance,
    cin_number: cinNumber,
    cin_delivered_le: cinDeliveredLe || null,
    license_issue_date: licenseIssueDate,
    driver_address: driverAddress,
    driver_phone: driverPhone,
    driver_license_number: driverLicenseNumber,
    driver_passport_number: driverPassportNumber,
    passport_delivered_le: passportDeliveredLe,
    has_second_driver: hasSecondDriver,
    second_driver_prenom: hasSecondDriver ? secondDriverPrenom : "",
    second_driver_nom: hasSecondDriver ? secondDriverNom : "",
    second_driver_date_naissance: hasSecondDriver ? secondDriverDateNaissance : null,
    second_driver_address: hasSecondDriver ? secondDriverAddress : "",
    second_driver_phone: hasSecondDriver ? secondDriverPhone : "",
    second_driver_cin_number: hasSecondDriver ? secondDriverCinNumber : "",
    second_driver_cin_delivered_le: hasSecondDriver ? (secondDriverCinDeliveredLe || null) : null,
    second_driver_license_number: hasSecondDriver ? secondDriverLicenseNumber : "",
    second_driver_passport_number: hasSecondDriver ? secondDriverPassportNumber : "",
    second_driver_passport_delivered_le: hasSecondDriver ? (secondDriverPassportDeliveredLe || null) : null,
    start_date: startDate,
    end_date: endDate,
    start_time: startTime,
    end_time: endTime,
  });

  return NextResponse.json({
    success: true,
    whatsappData: {
      vehicleLabel, prenom, nom, dateNaissance, cinNumber, licenseIssueDate,
      driverAddress, driverPhone, driverLicenseNumber, driverPassportNumber,
      hasSecondDriver,
      secondDriverPrenom: hasSecondDriver ? secondDriverPrenom : undefined,
      secondDriverNom: hasSecondDriver ? secondDriverNom : undefined,
      secondDriverCinNumber: hasSecondDriver ? secondDriverCinNumber : undefined,
      startDate, endDate, startTime, endTime,
    },
  });
}
