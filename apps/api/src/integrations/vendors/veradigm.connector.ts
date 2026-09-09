import { Injectable } from '@nestjs/common';
import { VendorConnectorBase } from './vendor-connector.base';
@Injectable()
export class VeradigmConnector extends VendorConnectorBase {
  public override readonly provider = 'veradigm';
  protected override get displayName(){ return 'Veradigm / Allscripts'; }
  protected override get mrnPrefix(){ return 'VRN'; }
  protected override get appointmentPrefix(){ return 'appt'; }
  protected override get patientPrefix(){ return 'Synthetic'; }
}
