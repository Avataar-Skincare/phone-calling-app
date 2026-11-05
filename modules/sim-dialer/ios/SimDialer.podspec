Pod::Spec.new do |s|
  s.name           = 'SimDialer'
  s.version        = '1.0.0'
  s.summary        = 'Places SIM calls and reports call state for Compass Dialer.'
  s.description    = 'Opens tel: links and observes outgoing calls with CXCallObserver.'
  s.license        = 'UNLICENSED'
  s.author         = 'Avataar Skincare'
  s.homepage       = 'https://avataarskin.com'
  s.platforms      = { :ios => '16.4' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.frameworks = 'CallKit'

  s.source_files = '*.{h,m,mm,swift}'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
