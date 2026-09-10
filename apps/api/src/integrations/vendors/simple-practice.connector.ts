import { Injectable } from '@nestjs/common';
import { VendorConnectorBase } from './vendor-connector.base';
@Injectable()
export class SimplePracticeConnector extends VendorConnectorBase {
  public override readonly provider = 'simplepractice';
  protected override get displayName(){ return 'SimplePractice'; }
  protected override get mrnPrefix(){ return 'SRN'; }
  protected override get appointmentPrefix(){ return 'appt'; }
  protected override get patientPrefix(){ return 'Synthetic'; }
}
